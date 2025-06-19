import { ApplicationsGateway } from "@core/domain";
import { ComposioApplicationMapper } from "@core/adapters";
import { Composio } from "composio-core";

export class ComposioApplicationsGateway implements ApplicationsGateway {
  composio = new Composio({
    apiKey: process.env.REACT_APP_COMPOSIO_API_KEY,
  });

  // Cache to prevent repeated API calls
  private static appsCache: any[] | null = null;
  private static lastFetchTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static isLoading = false;

  constructor(private readonly appsMapper: ComposioApplicationMapper) {}

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
          console.warn(`[ComposioApplicationsGateway] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          
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
          console.warn(`[ComposioApplicationsGateway] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError!;
  }

  getAvailableApplications = async () => {
    console.log("[ComposioApplicationsGateway] Checking cache...");
    
    // Return cached data if available and not expired
    const now = Date.now();
    if (
      ComposioApplicationsGateway.appsCache && 
      (now - ComposioApplicationsGateway.lastFetchTime) < ComposioApplicationsGateway.CACHE_DURATION
    ) {
      console.log("[ComposioApplicationsGateway] Returning cached apps");
      return ComposioApplicationsGateway.appsCache.map((app) => this.appsMapper.toDomain(app));
    }

    // Prevent concurrent requests
    if (ComposioApplicationsGateway.isLoading) {
      console.log("[ComposioApplicationsGateway] Already loading, waiting...");
      // Wait for the ongoing request to complete
      while (ComposioApplicationsGateway.isLoading) {
        await this.delay(100);
      }
      // Try to return cached result
      if (ComposioApplicationsGateway.appsCache) {
        return ComposioApplicationsGateway.appsCache.map((app) => this.appsMapper.toDomain(app));
      }
    }

    ComposioApplicationsGateway.isLoading = true;

    try {
      console.log("[ComposioApplicationsGateway] Fetching apps from API with rate limiting...");
      
      const raw = await this.retryWithBackoff(
        () => this.composio.apps.list(),
        3, // 3 retries
        2000 // Start with 2 second delay
      );

      const filteredApps = raw
        // @ts-ignore
        .filter((app) => app.auth_schemes?.includes("OAUTH2"));

      // Cache the result
      ComposioApplicationsGateway.appsCache = filteredApps;
      ComposioApplicationsGateway.lastFetchTime = now;
      
      console.log(`[ComposioApplicationsGateway] Successfully fetched ${filteredApps.length} apps`);
      
      return filteredApps.map((app) => this.appsMapper.toDomain(app));
    } catch (error: any) {
      console.error("[ComposioApplicationsGateway] Failed to fetch apps:", error);
      
      // If we have cached data, return it even if stale
      if (ComposioApplicationsGateway.appsCache) {
        console.warn("[ComposioApplicationsGateway] Returning stale cached data due to API error");
        return ComposioApplicationsGateway.appsCache.map((app) => this.appsMapper.toDomain(app));
      }
      
      // Return empty array as fallback
      console.warn("[ComposioApplicationsGateway] No cached data available, returning empty array");
      return [];
    } finally {
      ComposioApplicationsGateway.isLoading = false;
    }
  };
}
