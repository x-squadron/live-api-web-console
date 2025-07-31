import dotenv from 'dotenv';
import { MemorySaver } from "@langchain/langgraph";
import { createSwarm } from "@langchain/langgraph-swarm";
import { HumanMessage } from "@langchain/core/messages";
import { AgentFactory } from "./AgentFactory.js";

dotenv.config();

/**
 * MultiSwarmManager - Manages multiple swarms with inter-swarm communication
 * Supports dynamic swarm creation, agent discovery, and cross-swarm coordination
 */
export class MultiSwarmManager {
  constructor() {
    console.log('[MultiSwarmManager] Initializing multi-swarm system...');
    
    // Shared memory saver for cross-swarm communication
    this.sharedMemory = new MemorySaver();
    
    // Registry of all swarms
    this.swarms = new Map();
    
    // Registry of all agents across swarms
    this.agentRegistry = new Map();
    
    // Inter-swarm communication queue
    this.communicationQueue = [];
    
    // Initialize agent factory
    this.agentFactory = new AgentFactory(this);
    
    // Initialize default swarms
    this.initializeDefaultSwarms();
    
    console.log('[MultiSwarmManager] Multi-swarm system initialized');
  }

  /**
   * Initialize default swarms
   */
  initializeDefaultSwarms() {
    // Create agents using the factory (which injects inter-swarm tools)
    const linearAgent = this.agentFactory.createLinearAgent('project-management');
    const clickupAgent = this.agentFactory.createClickUpAgent('project-management');
    const slackAgent = this.agentFactory.createSlackAgent('communication');

    // Project Management Swarm
    this.createSwarm('project-management', {
      name: 'Project Management Swarm',
      description: 'Handles project management tasks across Linear and ClickUp',
      agents: [linearAgent, clickupAgent],
      defaultAgent: 'linear_assistant',
      capabilities: ['issue-management', 'task-creation', 'project-tracking']
    });

    // Communication Swarm
    this.createSwarm('communication', {
      name: 'Communication Swarm',
      description: 'Handles team communication through Slack and other channels',
      agents: [slackAgent],
      defaultAgent: 'slack_assistant',
      capabilities: ['slack-messaging', 'team-notifications', 'status-updates']
    });

    // Add more swarms as needed
    // this.createSwarm('development', { ... });
  }

  /**
   * Create a new swarm
   */
  createSwarm(swarmId, config) {
    try {
      console.log(`[MultiSwarmManager] Creating swarm: ${swarmId}`);
      
      // Create the swarm
      const swarm = createSwarm({
        agents: config.agents,
        defaultActiveAgent: config.defaultAgent,
      });
      
      // Compile with shared memory
      const app = swarm.compile({ checkpointer: this.sharedMemory });
      
      // Store swarm configuration
      this.swarms.set(swarmId, {
        id: swarmId,
        name: config.name,
        description: config.description,
        swarm: swarm,
        app: app,
        agents: config.agents,
        defaultAgent: config.defaultAgent,
        capabilities: config.capabilities || [],
        createdAt: new Date().toISOString(),
        status: 'active'
      });
      
      // Register agents in the global registry
      config.agents.forEach(agent => {
        this.agentRegistry.set(agent.name, {
          agentId: agent.name,
          swarmId: swarmId,
          agent: agent,
          capabilities: this.extractAgentCapabilities(agent),
          status: 'active'
        });
      });
      
      console.log(`[MultiSwarmManager] Swarm ${swarmId} created successfully`);
      return { success: true, swarmId };
      
    } catch (error) {
      console.error(`[MultiSwarmManager] Error creating swarm ${swarmId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract capabilities from an agent
   */
  extractAgentCapabilities(agent) {
    const capabilities = [];
    
    // Analyze agent tools to determine capabilities
    if (agent.tools) {
      agent.tools.forEach(tool => {
        if (tool.name.includes('LINEAR')) {
          capabilities.push('linear-management');
        } else if (tool.name.includes('CLICKUP')) {
          capabilities.push('clickup-management');
        } else if (tool.name.includes('SLACK')) {
          capabilities.push('slack-messaging');
        } else if (tool.name.includes('GMAIL')) {
          capabilities.push('email-management');
        } else if (tool.name.includes('CALENDAR')) {
          capabilities.push('calendar-management');
        }
      });
    }
    
    return capabilities;
  }

  /**
   * Get all available swarms
   */
  getAllSwarms() {
    const swarms = {};
    for (const [swarmId, swarm] of this.swarms) {
      swarms[swarmId] = {
        id: swarm.id,
        name: swarm.name,
        description: swarm.description,
        capabilities: swarm.capabilities,
        agentCount: swarm.agents.length,
        status: swarm.status,
        createdAt: swarm.createdAt
      };
    }
    return swarms;
  }

  /**
   * Get all available agents across all swarms
   */
  getAllAgents() {
    const agents = {};
    for (const [agentId, agent] of this.agentRegistry) {
      agents[agentId] = {
        agentId: agent.agentId,
        swarmId: agent.swarmId,
        capabilities: agent.capabilities,
        status: agent.status
      };
    }
    return agents;
  }

  /**
   * Find agents by capability
   */
  findAgentsByCapability(capability) {
    const matchingAgents = [];
    for (const [agentId, agent] of this.agentRegistry) {
      if (agent.capabilities.includes(capability)) {
        matchingAgents.push({
          agentId: agent.agentId,
          swarmId: agent.swarmId,
          capabilities: agent.capabilities
        });
      }
    }
    return matchingAgents;
  }

  /**
   * Process request with specific swarm
   */
  async processWithSwarm(swarmId, request, userId = 'default_user', threadId = null) {
    try {
      const swarm = this.swarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm '${swarmId}' not found`);
      }

      console.log(`[MultiSwarmManager] Processing request with swarm ${swarmId}:`, request.length > 500 ? request.slice(0, 500) + '...[truncated]' : request);
      
      // Generate thread ID if not provided
      if (!threadId) {
        threadId = `swarm_${swarmId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      const config = { 
        configurable: { 
          user_id: userId, 
          thread_id: threadId 
        },
        streamMode: "values",
        recursionLimit: 50  // Increase recursion limit to avoid the error
      };

      // Send the message to the swarm
      const inputs = { messages: [new HumanMessage(request)] };
      
      let lastMessage = null;
      let allMessages = [];
      let messageCount = 0;
      const maxMessages = 30; // Prevent infinite loops
      
      // Stream the response with timeout protection
      const stream = await swarm.app.stream(inputs, config);
      for await (const event of stream) {
        if (event.messages && event.messages.length > 0) {
          lastMessage = event.messages[event.messages.length - 1];
          allMessages = event.messages;
          messageCount++;
          
          // Prevent infinite loops
          if (messageCount > maxMessages) {
            console.warn(`[MultiSwarmManager] Message limit reached (${maxMessages}), stopping stream to prevent infinite loop`);
            break;
          }
          
          // Log each message in the flow
          event.messages.forEach((msg, idx) => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            console.log(`[MultiSwarmManager][Swarm:${swarmId}][Thread:${threadId}] Message[${idx}]:`, content.length > 500 ? content.slice(0, 500) + '...[truncated]' : content);
            if (msg.tool_calls) {
              console.log(`[MultiSwarmManager][Swarm:${swarmId}][Thread:${threadId}] Tool calls:`, JSON.stringify(msg.tool_calls));
            }
            if (msg.agent_name) {
              console.log(`[MultiSwarmManager][Swarm:${swarmId}][Thread:${threadId}] Agent:`, msg.agent_name);
            }
          });
        }
      }
      
      console.log(`[MultiSwarmManager] Swarm ${swarmId} processing completed for thread ${threadId}`);
      
      return {
        success: true,
        swarmId: swarmId,
        messages: allMessages,
        response: lastMessage?.content || 'Task completed',
        threadId: threadId,
        userId: userId,
        toolCalls: lastMessage?.tool_calls?.length || 0
      };
      
    } catch (error) {
      console.error(`[MultiSwarmManager] Error processing with swarm ${swarmId}:`, error);
      return {
        success: false,
        swarmId: swarmId,
        error: error.message,
        threadId: threadId,
        userId: userId
      };
    }
  }

  /**
   * Route request to best matching swarm
   */
  async routeToBestSwarm(request, userId = 'default_user') {
    try {
      console.log(`[MultiSwarmManager] Routing request to best swarm:`, request.length > 500 ? request.slice(0, 500) + '...[truncated]' : request);
      
      // Analyze request to determine best swarm
      const bestSwarmId = this.analyzeRequestForBestSwarm(request);
      
      if (!bestSwarmId) {
        // Default to project management swarm
        return await this.processWithSwarm('project-management', request, userId);
      }
      
      return await this.processWithSwarm(bestSwarmId, request, userId);
      
    } catch (error) {
      console.error(`[MultiSwarmManager] Error routing to best swarm:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze request to determine best swarm
   */
  analyzeRequestForBestSwarm(request) {
    const requestLower = request.toLowerCase();
    
    // Project management keywords
    if (requestLower.includes('linear') || requestLower.includes('clickup') || 
        requestLower.includes('issue') || requestLower.includes('task') || 
        requestLower.includes('project') || requestLower.includes('meeting')) {
      return 'project-management';
    }
    
    // Communication keywords
    if (requestLower.includes('email') || requestLower.includes('gmail') || 
        requestLower.includes('slack') || requestLower.includes('message') ||
        requestLower.includes('notify') || requestLower.includes('notification') ||
        requestLower.includes('communication') || requestLower.includes('channel')) {
      return 'communication';
    }
    
    // Development keywords
    if (requestLower.includes('code') || requestLower.includes('github') || 
        requestLower.includes('deploy') || requestLower.includes('build')) {
      return 'development';
    }
    
    return null; // Will default to project-management
  }

  /**
   * Inter-swarm communication
   */
  async communicateBetweenSwarms(fromSwarmId, toSwarmId, message, context = {}) {
    try {
      console.log(`[MultiSwarmManager] Inter-swarm communication: ${fromSwarmId} -> ${toSwarmId}`);
      
      // Add to communication queue
      const communicationId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const communication = {
        id: communicationId,
        fromSwarmId,
        toSwarmId,
        message,
        context,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      this.communicationQueue.push(communication);
      
      // Process the communication
      const result = await this.processWithSwarm(toSwarmId, message, 'system', communicationId);
      
      // Update communication status
      communication.status = result.success ? 'completed' : 'failed';
      communication.result = result;
      
      console.log(`[MultiSwarmManager] Inter-swarm communication completed: ${communicationId}`);
      
      return {
        success: true,
        communicationId,
        result
      };
      
    } catch (error) {
      console.error(`[MultiSwarmManager] Error in inter-swarm communication:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get communication history
   */
  getCommunicationHistory(swarmId = null) {
    if (swarmId) {
      return this.communicationQueue.filter(comm => 
        comm.fromSwarmId === swarmId || comm.toSwarmId === swarmId
      );
    }
    return this.communicationQueue;
  }

  /**
   * Get system health
   */
  getHealth() {
    return {
      success: true,
      systemStatus: 'healthy',
      totalSwarms: this.swarms.size,
      totalAgents: this.agentRegistry.size,
      activeCommunications: this.communicationQueue.filter(c => c.status === 'pending').length,
      swarms: this.getAllSwarms(),
      agents: this.getAllAgents(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Destroy a swarm
   */
  destroySwarm(swarmId) {
    try {
      const swarm = this.swarms.get(swarmId);
      if (!swarm) {
        throw new Error(`Swarm '${swarmId}' not found`);
      }
      
      // Remove agents from registry
      swarm.agents.forEach(agent => {
        this.agentRegistry.delete(agent.name);
      });
      
      // Remove swarm
      this.swarms.delete(swarmId);
      
      console.log(`[MultiSwarmManager] Swarm ${swarmId} destroyed successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`[MultiSwarmManager] Error destroying swarm ${swarmId}:`, error);
      return { success: false, error: error.message };
    }
  }
} 