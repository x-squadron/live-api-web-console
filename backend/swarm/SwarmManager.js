import dotenv from 'dotenv';
import { MemorySaver } from "@langchain/langgraph";
import { createSwarm } from "@langchain/langgraph-swarm";
import { HumanMessage } from "@langchain/core/messages";
import { linearAssistant } from "./agents/linearAgent.js";
import { clickupAssistant } from "./agents/clickupAgent.js";

dotenv.config();

/**
 * SwarmManager - Manages a swarm of specialized agents using langraph-swarm
 * Routes requests to appropriate agents and handles agent handoffs
 */
export class SwarmManager {
  constructor() {
    console.log('[SwarmManager] Initializing with langraph-swarm...');
    
    // Create memory saver for maintaining conversation state
    this.checkpointer = new MemorySaver();
    
    // Create the swarm with both agents
    this.swarm = createSwarm({
      agents: [linearAssistant, clickupAssistant],
      defaultActiveAgent: "linear_assistant", // Start with Linear agent by default
    });
    
    // Compile the swarm with memory
    this.app = this.swarm.compile({ checkpointer: this.checkpointer });
    
    console.log('[SwarmManager] Swarm initialized with Linear and ClickUp agents');
  }

  /**
   * Get available agent types
   */
  getAvailableAgents() {
    return ['linear', 'clickup'];
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentType) {
    const agentMap = {
      linear: {
        agentType: 'linear',
        status: 'active',
        tools: [
          'LINEAR_LIST_LINEAR_ISSUES',
          'LINEAR_CREATE_LINEAR_ISSUE', 
          'LINEAR_UPDATE_ISSUE',
          'LINEAR_DELETE_LINEAR_ISSUE',
          'LINEAR_CREATE_LINEAR_COMMENT',
          'LINEAR_LIST_LINEAR_TEAMS',
          'LINEAR_LIST_LINEAR_PROJECTS',
          'LINEAR_GET_LABELS',
          'LINEAR_LIST_LINEAR_STATES'
        ],
        description: 'Specialized Linear project management agent with handoff capabilities'
      },
      clickup: {
        agentType: 'clickup',
        status: 'active',
        tools: [
          'CLICKUP_CREATE_TASK',
          'CLICKUP_UPDATE_TASK', 
          'CLICKUP_DELETE_TASK',
          'CLICKUP_CREATE_TASK_COMMENT'
        ],
        description: 'Specialized ClickUp task management agent with handoff capabilities'
      }
    };

    const agent = agentMap[agentType.toLowerCase()];
    if (!agent) {
      return {
        agentType,
        status: 'not_found',
        error: `Agent type '${agentType}' not found. Available agents: ${this.getAvailableAgents().join(', ')}`
      };
    }

    return agent;
  }

  /**
   * Get information about all agents
   */
  getAllAgentsInfo() {
    const agentsInfo = {};
    
    for (const agentType of this.getAvailableAgents()) {
      const agentInfo = this.getAgentInfo(agentType);
      if (agentInfo.status !== 'not_found') {
        agentsInfo[agentType] = agentInfo;
      }
    }
    
    return agentsInfo;
  }

  /**
   * Process request with the swarm (allows agent handoffs)
   */
  async processWithSwarm(request, userId = 'default_user', threadId = null) {
    try {
      console.log(`[SwarmManager] Processing request with swarm:`, request.length > 500 ? request.slice(0, 500) + '...[truncated]' : request);
      
      // Generate thread ID if not provided
      if (!threadId) {
        threadId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
             const config = { 
         configurable: { 
           user_id: userId, 
           thread_id: threadId 
         },
         streamMode: "values"
       };

       // Send the message to the swarm
      const inputs = { messages: [new HumanMessage(request)] };
      
      let lastMessage = null;
      let allMessages = [];
      
      // Stream the response
      const stream = await this.app.stream(inputs, config);
      for await (const event of stream) {
        if (event.messages && event.messages.length > 0) {
          lastMessage = event.messages[event.messages.length - 1];
          allMessages = event.messages;
          // Log each message in the flow
          event.messages.forEach((msg, idx) => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            console.log(`[SwarmManager][Thread:${threadId}] Message[${idx}]:`, content.length > 500 ? content.slice(0, 500) + '...[truncated]' : content);
            if (msg.tool_calls) {
              console.log(`[SwarmManager][Thread:${threadId}] Tool calls:`, JSON.stringify(msg.tool_calls));
            }
            if (msg.agent_name) {
              console.log(`[SwarmManager][Thread:${threadId}] Agent:`, msg.agent_name);
            }
          });
        }
      }
      
      console.log(`[SwarmManager] Swarm processing completed for thread ${threadId}`);
      
      return {
        success: true,
        messages: allMessages,
        response: lastMessage?.content || 'Task completed',
        threadId: threadId,
        userId: userId,
        toolCalls: lastMessage?.tool_calls?.length || 0
      };
      
    } catch (error) {
      console.error(`[SwarmManager] Error processing with swarm:`, error);
      return {
        success: false,
        error: error.message,
        threadId: threadId,
        userId: userId
      };
    }
  }

  /**
   * Route request to specific agent (with potential handoffs)
   */
  async routeRequest(agentType, request, userId = 'default_user') {
    try {
      console.log(`[SwarmManager] Routing request to ${agentType} agent:`, request.length > 500 ? request.slice(0, 500) + '...[truncated]' : request);
      
      // Map agent type to internal agent name
      const agentNameMap = {
        linear: 'linear_assistant',
        clickup: 'clickup_assistant'
      };
      
      const agentName = agentNameMap[agentType.toLowerCase()];
      if (!agentName) {
        throw new Error(`Agent type '${agentType}' not found. Available agents: ${this.getAvailableAgents().join(', ')}`);
      }
      
      // Create a new swarm instance starting with the specified agent
      const targetSwarm = createSwarm({
        agents: [linearAssistant, clickupAssistant],
        defaultActiveAgent: agentName,
      });
      
      const targetApp = targetSwarm.compile({ checkpointer: this.checkpointer });
      
      const threadId = `${agentType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
             const config = { 
         configurable: { 
           user_id: userId, 
           thread_id: threadId 
         },
         streamMode: "values"
       };

       // Send the message to the specific agent
      const inputs = { messages: [new HumanMessage(request)] };
      
      let lastMessage = null;
      let allMessages = [];
      
      // Stream the response
      const stream = await targetApp.stream(inputs, config);
      for await (const event of stream) {
        if (event.messages && event.messages.length > 0) {
          lastMessage = event.messages[event.messages.length - 1];
          allMessages = event.messages;
          // Log each message in the flow
          event.messages.forEach((msg, idx) => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            console.log(`[SwarmManager][Thread:${threadId}][${agentType}] Message[${idx}]:`, content.length > 500 ? content.slice(0, 500) + '...[truncated]' : content);
            if (msg.tool_calls) {
              console.log(`[SwarmManager][Thread:${threadId}][${agentType}] Tool calls:`, JSON.stringify(msg.tool_calls));
            }
            if (msg.agent_name) {
              console.log(`[SwarmManager][Thread:${threadId}][${agentType}] Agent:`, msg.agent_name);
            }
          });
        }
      }
      
      console.log(`[SwarmManager] ${agentType} agent completed request for thread ${threadId}`);
      
      return {
        success: true,
        agentType,
        result: {
          success: true,
          messages: allMessages,
          response: lastMessage?.content || 'Task completed',
          toolCalls: lastMessage?.tool_calls?.length || 0
        }
      };
      
    } catch (error) {
      console.error(`[SwarmManager] Error routing request to ${agentType}:`, error);
      return {
        success: false,
        agentType,
        error: error.message
      };
    }
  }

  /**
   * Process meeting transcript with specific agent
   */
  async processMeetingTranscript(agentType, transcript, meetingId, userId = 'default_user') {
    try {
      console.log(`[SwarmManager] Processing meeting transcript with ${agentType} agent for meeting ${meetingId}`);
      
      const meetingPrompt = `
Process this meeting transcript and create relevant tasks/issues for action items discussed.

Meeting ID: ${meetingId}
Meeting Transcript:
${transcript}

Instructions:
1. Analyze the transcript and identify actionable items, tasks, and decisions
2. For each actionable item, create appropriate tasks/issues with:
   - Clear, descriptive titles
   - Detailed descriptions including context from the meeting
   - Appropriate priority levels based on urgency discussed
   - Assignees if mentioned in the transcript
   - Due dates if mentioned or can be inferred
   - Relevant tags/labels (e.g., "meeting", "action-item", "discussion")
3. Include meeting context and relevant quotes in descriptions
4. Provide a summary of all tasks/issues created

Please process this meeting transcript and create the appropriate tasks/issues.
`;

      const result = await this.routeRequest(agentType, meetingPrompt, userId);
      
      console.log(`[SwarmManager] Meeting transcript processed successfully with ${agentType} agent`);
      
      return {
        success: true,
        agentType: agentType,
        meetingId: meetingId,
        result: result.result
      };
      
    } catch (error) {
      console.error(`[SwarmManager] Error processing meeting transcript with ${agentType}:`, error);
      return {
        success: false,
        agentType: agentType,
        meetingId: meetingId,
        error: error.message
      };
    }
  }

  /**
   * Get swarm health status
   */
  getHealth() {
    return {
      success: true,
      swarmStatus: 'healthy',
      totalAgents: this.getAvailableAgents().length,
      availableAgents: this.getAvailableAgents(),
      agents: this.getAllAgentsInfo(),
      timestamp: new Date().toISOString()
    };
  }
} 