import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tools for inter-swarm communication and coordination
 * These tools allow agents to discover and communicate with other swarms
 */

// Tool to discover available swarms
export const discoverSwarms = tool(
  async (args) => {
    // Get multiSwarmManager from global context or return placeholder
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      const swarms = multiSwarmManager.getAllSwarms();
      return JSON.stringify({
        success: true,
        swarms: swarms,
        totalSwarms: Object.keys(swarms).length
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "discover_swarms",
    description: "Discover all available swarms in the system and their capabilities",
    schema: z.object({}),
  }
);

// Tool to find agents by capability
export const findAgentsByCapability = tool(
  async (args) => {
    const { capability } = args;
    // Get multiSwarmManager from global context
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      // Get all swarms and find agents with the specified capability
      const swarms = multiSwarmManager.getAllSwarms();
      const matchingAgents = [];
      
      for (const [swarmId, swarm] of Object.entries(swarms)) {
        if (swarm.agents) {
          for (const [agentId, agent] of Object.entries(swarm.agents)) {
            if (agent.capabilities && agent.capabilities.includes(capability)) {
              matchingAgents.push({
                swarmId,
                agentId,
                capabilities: agent.capabilities
              });
            }
          }
        }
      }
      
      return JSON.stringify({
        success: true,
        capability,
        agents: matchingAgents,
        totalMatches: matchingAgents.length
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "find_agents_by_capability",
    description: "Find agents that have a specific capability (e.g., 'linear-management', 'email-management')",
    schema: z.object({
      capability: z.string().describe("The capability to search for")
    }),
  }
);

// Tool to communicate with another swarm
export const communicateWithSwarm = tool(
  async (args) => {
    const { targetSwarmId, message, context } = args;
    // Get multiSwarmManager from global context
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      // Check if we have the required dependencies
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      // For now, we'll use a default swarm ID since we can't easily get the current one
      const currentSwarmId = "project-management";

      console.log(`[InterSwarmTool] Communicating from ${currentSwarmId} to ${targetSwarmId}`);
      console.log(`[InterSwarmTool] Message: ${message}`);

      // Use the MultiSwarmManager to communicate between swarms
      const result = await multiSwarmManager.communicateBetweenSwarms(
        currentSwarmId,
        targetSwarmId,
        message,
        context || {}
      );
      
      console.log(`[InterSwarmTool] Communication result:`, result);
      
      return JSON.stringify({
        success: result.success,
        communicationId: result.communicationId,
        response: result.result?.response || 'No response received',
        error: result.error || null
      });
    } catch (error) {
      console.error(`[InterSwarmTool] Error in communication:`, error);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "communicate_with_swarm",
    description: "Send a message to another swarm and get a response",
    schema: z.object({
      targetSwarmId: z.string().describe("ID of the swarm to communicate with"),
      message: z.string().describe("Message to send to the swarm"),
      context: z.object({}).optional().describe("Additional context for the communication")
    }),
  }
);

// Tool to get communication history
export const getCommunicationHistory = tool(
  async (args) => {
    // Get multiSwarmManager from global context
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      // This would typically query a database or storage system
      // For now, return a placeholder response
      return JSON.stringify({
        success: true,
        history: [],
        message: "Communication history not yet implemented"
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "get_communication_history",
    description: "Get the history of communications between swarms",
    schema: z.object({}),
  }
);

// Tool to delegate to the best swarm for a task
export const delegateToBestSwarm = tool(
  async (args) => {
    const { task, context } = args;
    // Get multiSwarmManager from global context
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      // Simple delegation logic - can be enhanced with more sophisticated routing
      let targetSwarmId = 'project-management'; // default
      
      if (task.toLowerCase().includes('slack') || task.toLowerCase().includes('notification') || task.toLowerCase().includes('communication')) {
        targetSwarmId = 'communication';
      } else if (task.toLowerCase().includes('linear') || task.toLowerCase().includes('issue')) {
        targetSwarmId = 'project-management';
      } else if (task.toLowerCase().includes('clickup') || task.toLowerCase().includes('task')) {
        targetSwarmId = 'project-management';
      }

      console.log(`[InterSwarmTool] Delegating task to ${targetSwarmId}: ${task}`);

      // For now, we'll use a default swarm ID since we can't easily get the current one
      const currentSwarmId = "project-management";
      
      const result = await multiSwarmManager.communicateBetweenSwarms(
        currentSwarmId,
        targetSwarmId,
        task,
        context || {}
      );
      
      return JSON.stringify({
        success: result.success,
        delegatedTo: targetSwarmId,
        response: result.result?.response || 'No response received',
        error: result.error || null
      });
    } catch (error) {
      console.error(`[InterSwarmTool] Error in delegation:`, error);
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "delegate_to_best_swarm",
    description: "Delegate a task to the most appropriate swarm based on the task description",
    schema: z.object({
      task: z.string().describe("Description of the task to delegate"),
      context: z.object({}).optional().describe("Additional context for the delegation")
    }),
  }
);

// Tool to get system health and status
export const getSystemHealth = tool(
  async (args) => {
    // Get multiSwarmManager from global context
    const multiSwarmManager = global.multiSwarmManager;
    
    try {
      if (!multiSwarmManager) {
        return JSON.stringify({
          success: false,
          error: "MultiSwarmManager not available - this tool needs to be used within a swarm context"
        });
      }

      const swarms = multiSwarmManager.getAllSwarms();
      const healthStatus = {};
      
      for (const [swarmId, swarm] of Object.entries(swarms)) {
        healthStatus[swarmId] = {
          status: 'active',
          agentCount: swarm.agents ? Object.keys(swarm.agents).length : 0,
          lastActivity: new Date().toISOString()
        };
      }
      
      return JSON.stringify({
        success: true,
        systemStatus: 'healthy',
        swarms: healthStatus,
        totalSwarms: Object.keys(swarms).length
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message
      });
    }
  },
  {
    name: "get_system_health",
    description: "Get the health status of all swarms in the system",
    schema: z.object({}),
  }
);

// Export all tools
export const interSwarmTools = [
  discoverSwarms,
  findAgentsByCapability,
  communicateWithSwarm,
  getCommunicationHistory,
  delegateToBestSwarm,
  getSystemHealth
]; 