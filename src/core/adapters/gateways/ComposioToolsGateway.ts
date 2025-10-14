import { Tool, ToolsGateway } from "@core/domain";
import { ActionDetails, Composio } from "composio-core";
import { ComposioToolMapper } from "@core/adapters";

export class ComposioToolsGateway implements ToolsGateway {
  private readonly composio: Composio;
  
  // Cache to prevent repeated API calls
  private static toolsCache: Map<string, Tool[]> = new Map();
  private static lastFetchTimes: Map<string, number> = new Map();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static loadingApps: Set<string> = new Set();

  constructor(private readonly toolsMapper: ComposioToolMapper) {
    this.composio = new Composio({
      apiKey: process.env.REACT_APP_COMPOSIO_API_KEY,
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // If it's a rate limit error, wait longer
        if (error.message?.includes('rate limit') || error.status === 429) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
          console.warn(`[ComposioToolsGateway] Rate limit hit for ${fn.name}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          if (attempt < maxRetries) {
            await this.delay(delay);
            continue;
          }
        }
        
        // For non-rate-limit errors, don't retry
        if (attempt === 0 && !error.message?.includes('rate limit') && error.status !== 429) {
          throw error;
        }
        
        // For rate limit errors, try all retries
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[ComposioToolsGateway] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError!;
  }

  getApplicationTools = async (appName: string): Promise<Tool[]> => {
    const cacheKey = appName.toLowerCase();
    const now = Date.now();
    
    console.log(`[ComposioToolsGateway] Getting tools for ${appName}...`);
    
    // Return cached data if available and not expired
    if (
      ComposioToolsGateway.toolsCache.has(cacheKey) && 
      ComposioToolsGateway.lastFetchTimes.has(cacheKey) &&
      (now - ComposioToolsGateway.lastFetchTimes.get(cacheKey)!) < ComposioToolsGateway.CACHE_DURATION
    ) {
      console.log(`[ComposioToolsGateway] Returning cached tools for ${appName}`);
      return ComposioToolsGateway.toolsCache.get(cacheKey)!;
    }

    // Prevent concurrent requests for the same app
    if (ComposioToolsGateway.loadingApps.has(cacheKey)) {
      console.log(`[ComposioToolsGateway] Already loading tools for ${appName}, waiting...`);
      // Wait for the ongoing request to complete
      while (ComposioToolsGateway.loadingApps.has(cacheKey)) {
        await this.delay(100);
      }
      // Try to return cached result
      if (ComposioToolsGateway.toolsCache.has(cacheKey)) {
        return ComposioToolsGateway.toolsCache.get(cacheKey)!;
      }
    }

    ComposioToolsGateway.loadingApps.add(cacheKey);

    try {
      console.log(`[ComposioToolsGateway] Fetching tools for ${appName} from API with rate limiting...`);
      
      const raw = await this.retryWithBackoff(
        () => this.composio.actions.list({
          apps: cacheKey,
        }),
        3, // 3 retries
        2000 // Start with 2 second delay
      );

      const tools = raw.items.map((action: ActionDetails) =>
        this.toolsMapper.toDomain(action)
      );

      // Cache the result
      ComposioToolsGateway.toolsCache.set(cacheKey, tools);
      ComposioToolsGateway.lastFetchTimes.set(cacheKey, now);
      
      console.log(`[ComposioToolsGateway] Successfully fetched ${tools.length} tools for ${appName}`);
      
      return tools;
    } catch (error: any) {
      console.error(`[ComposioToolsGateway] Failed to fetch tools for ${appName}:`, error);
      
      // If we have cached data, return it even if stale
      if (ComposioToolsGateway.toolsCache.has(cacheKey)) {
        console.warn(`[ComposioToolsGateway] Returning stale cached tools for ${appName} due to API error`);
        return ComposioToolsGateway.toolsCache.get(cacheKey)!;
      }
      
      // Return empty array as fallback
      console.warn(`[ComposioToolsGateway] No cached tools available for ${appName}, returning empty array`);
      return [];
    } finally {
      ComposioToolsGateway.loadingApps.delete(cacheKey);
    }
  };
}
