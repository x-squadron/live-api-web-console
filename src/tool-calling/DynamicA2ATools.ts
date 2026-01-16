import { Type, Tool } from "@google/genai";
import { RealAgentManager } from "../agents/RealAgentManager";
import { AgentDiscoveryResult, DelegateTaskResponse } from "../a2a/types";

export async function createDynamicA2ATools(): Promise<Tool[]> {

  return [
    {
      functionDeclarations: [
        {
          name: "discover_agents",
          description: "Discover and list all available specialized A2A agents in the system. Use this to find agents that can handle specific app-related tasks like Google Calendar, Gmail, etc.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              appName: {
                type: Type.STRING,
                description: "Optional: Filter agents by specific app name (e.g., 'Google Calendar', 'Gmail'). Leave empty to get all agents."
              }
            },
            required: []
          }
        },
        {
          name: "delegate_to_agent",
          description: "Delegate a task to a specific specialized agent. Use this when you find an appropriate agent through discover_agents that can handle the user's request. The message parameter can contain multiline text, newlines, and special characters - they will be handled properly.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              agentId: {
                type: Type.STRING,
                description: "The ID of the agent to delegate the task to (obtained from discover_agents)"
              },
              message: {
                type: Type.STRING,
                description: "The task or message to send to the specialized agent. Can contain multiline text, newlines, and special characters. All text formatting will be preserved and passed correctly to the target agent."
              }
            },
            required: ["agentId", "message"]
          }
        }
      ]
    }
  ];
}

export async function handleA2AToolCall(functionName: string, args: any): Promise<any> {
  const agentManager = RealAgentManager.getInstance();
  
  switch (functionName) {
    case "discover_agents":
      return await handleDiscoverAgentsReal(args, agentManager);
    
    case "delegate_to_agent":
      return await handleDelegateToAgentReal(args, agentManager);
    
    default:
      throw new Error(`Unknown A2A tool function: ${functionName}`);
  }
}

// Real backend handlers
async function handleDiscoverAgentsReal(
  args: { appName?: string }, 
  agentManager: RealAgentManager
): Promise<AgentDiscoveryResult> {
  try {
    console.log(`[DynamicA2ATools] Discovering agents via real backend, filter:`, args.appName);
    const result = await agentManager.discoverAgents(args.appName);
    console.log(`[DynamicA2ATools] Found ${result.agents.length} agents`);
    return result;
  } catch (error) {
    console.error(`[DynamicA2ATools] Error discovering agents:`, error);
    return {
      agents: []
    };
  }
}

async function handleDelegateToAgentReal(
  args: { agentId: string; message: string }, 
  agentManager: RealAgentManager
): Promise<DelegateTaskResponse> {
  try {
    // Ensure message is properly formatted and handle any string encoding issues
    const sanitizedMessage = typeof args.message === 'string' ? args.message : String(args.message);
    
    console.log(`[DynamicA2ATools] Delegating to agent ${args.agentId} via real backend:`, sanitizedMessage);
    const result = await agentManager.delegateTask({
      agentId: args.agentId,
      message: sanitizedMessage
    });
    console.log(`[DynamicA2ATools] Agent ${args.agentId} response:`, result.response);
    return result;
  } catch (error) {
    console.error(`[DynamicA2ATools] Error delegating to agent:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delegation error'
    };
  }
} 