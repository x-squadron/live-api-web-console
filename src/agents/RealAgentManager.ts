import { AgentInfo, CreateAgentRequest, AgentDiscoveryResult, DelegateTaskRequest, DelegateTaskResponse } from "../a2a/types";
import { COMPOSIO_ENTITY_ID } from "../components/composio-button/composioAppList";

export class RealAgentManager {
  private static instance: RealAgentManager;
  private baseUrl: string;

  private constructor() {
    // Use environment variable or default to localhost:3001
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
    console.log(`[RealAgentManager] Using backend URL: ${this.baseUrl}`);
  }

  public static getInstance(): RealAgentManager {
    if (!RealAgentManager.instance) {
      RealAgentManager.instance = new RealAgentManager();
    }
    return RealAgentManager.instance;
  }

  async createAgent(request: CreateAgentRequest): Promise<AgentInfo> {
    try {
      console.log(`[RealAgentManager] Creating React agent for ${request.appName} with tools:`, request.toolNames);

      // Generate a deterministic agent ID based on app name
      const agentId = `agent-${request.appName.toLowerCase().replace(/\s+/g, '-')}`;

      const response = await fetch(`${this.baseUrl}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agentId,
          appName: request.appName,
          actions: request.toolNames, // Backend expects 'actions' for Composio tool names
          systemPrompt: request.systemPrompt,
          userId: request.userId || COMPOSIO_ENTITY_ID
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HTTP ${response.status}: ${error.error || 'Unknown error'}`);
      }

      const result = await response.json();
      if (result.success && result.agent) {
        console.log(`[RealAgentManager] Successfully created React agent:`, result.agent);
        
        // Convert backend agent format to frontend AgentInfo format
        const agentInfo: AgentInfo = {
          id: result.agent.id,
          appName: result.agent.appName,
          name: result.agent.name,
          description: result.agent.description,
          url: result.agent.url,
          port: result.agent.port || 0, // Backend might not return port
          tools: result.agent.actions || [], // Backend returns 'actions' as tool names
          server: null, // Not used in API mode
          created: new Date(result.agent.created),
          lastUsed: result.agent.lastUsed ? new Date(result.agent.lastUsed) : undefined
        };
        
        return agentInfo;
      } else {
        throw new Error(result.error || 'Failed to create React agent');
      }

    } catch (error) {
      console.error(`[RealAgentManager] Error creating React agent:`, error);
      throw error;
    }
  }

  async destroyAgent(agentId: string): Promise<boolean> {
    try {
      console.log(`[RealAgentManager] Destroying agent ${agentId}`);

      const response = await fetch(`${this.baseUrl}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HTTP ${response.status}: ${error.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log(`[RealAgentManager] Agent ${agentId} destroyed successfully`);
      return result.success;

    } catch (error) {
      console.error(`[RealAgentManager] Error destroying agent ${agentId}:`, error);
      throw error;
    }
  }

  async discoverAgents(appNameFilter?: string): Promise<AgentDiscoveryResult> {
    try {
      const url = new URL(`${this.baseUrl}/api/agents`);
      if (appNameFilter) {
        url.searchParams.append('appName', appNameFilter);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HTTP ${response.status}: ${error.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log(`[RealAgentManager] Discovered ${result.agents.length} agents`);
      return result;

    } catch (error) {
      console.error(`[RealAgentManager] Error discovering agents:`, error);
      // Return empty result on error to avoid breaking the UI
      return { agents: [] };
    }
  }

  async delegateTask(request: DelegateTaskRequest): Promise<DelegateTaskResponse> {
    try {
      console.log(`[RealAgentManager] Delegating task to agent ${request.agentId}:`, request.message);

      const response = await fetch(`${this.baseUrl}/api/agents/${request.agentId}/delegate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.message,
          userId: request.userId || COMPOSIO_ENTITY_ID
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HTTP ${response.status}: ${error.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`[RealAgentManager] Task delegated successfully. Response:`, result.response);
        return {
          success: true,
          response: result.response
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error occurred'
        };
      }

    } catch (error) {
      console.error(`[RealAgentManager] Error delegating task:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Compatibility methods to match SimplifiedAgentManager interface
  getAgent(agentId: string): AgentInfo | undefined {
    // This is not directly supported in API mode
    // Would need to maintain a local cache or fetch from backend
    console.warn(`[RealAgentManager] getAgent(${agentId}) called but not implemented in API mode`);
    return undefined;
  }

  getAllAgents(): AgentInfo[] {
    // This is not directly supported in API mode
    console.warn(`[RealAgentManager] getAllAgents() called but not implemented in API mode`);
    return [];
  }

  getAgentsByApp(appName: string): AgentInfo[] {
    // This is not directly supported in API mode
    console.warn(`[RealAgentManager] getAgentsByApp(${appName}) called but not implemented in API mode`);
    return [];
  }

  async destroyAgentsByApp(appName: string): Promise<number> {
    try {
      // First discover agents for this app
      const result = await this.discoverAgents(appName);
      let destroyedCount = 0;

      // Destroy each agent
      for (const agent of result.agents) {
        try {
          const success = await this.destroyAgent(agent.id);
          if (success) {
            destroyedCount++;
          }
        } catch (error) {
          console.error(`[RealAgentManager] Error destroying agent ${agent.id}:`, error);
        }
      }

      console.log(`[RealAgentManager] Destroyed ${destroyedCount} agents for app ${appName}`);
      return destroyedCount;

    } catch (error) {
      console.error(`[RealAgentManager] Error destroying agents for app ${appName}:`, error);
      return 0;
    }
  }

  updateAgentLastUsed(agentId: string): void {
    // This is handled automatically by the backend when delegating tasks
    console.log(`[RealAgentManager] updateAgentLastUsed(${agentId}) - handled by backend`);
  }

  // Health check method
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[RealAgentManager] Backend health check passed:`, result);
        return true;
      } else {
        console.warn(`[RealAgentManager] Backend health check failed with status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`[RealAgentManager] Backend health check error:`, error);
      return false;
    }
  }
} 