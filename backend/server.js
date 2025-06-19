import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import {
  A2AServer,
  A2AClient,
  InMemoryTaskStore,
  configureLogger
} from '@artinet/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { OpenAIToolSet } from 'composio-core';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

console.log('🔄 Starting A2A Backend Server with LangChain React Agents...');

// Load environment variables
dotenv.config();
console.log('✅ Environment variables loaded');

// Configure logging
configureLogger({ level: 'info' });
console.log('✅ Artinet SDK logger configured');

const app = express();
const PORT = process.env.PORT || 3001;
console.log(`✅ Express app created, will use port ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json());
console.log('✅ Middleware configured');

// Default Composio Entity ID for tool execution (can be overridden per request)
const DEFAULT_COMPOSIO_ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || 'default_user';

// Store for managing dynamic React agents
class ReactAgentManager {
  constructor() {
    this.agents = new Map();
    this.portRange = { min: 4000, max: 4999 };
    this.usedPorts = new Set();
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for React agents');
    }
    
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize Composio toolset
    if (!process.env.COMPOSIO_API_KEY) {
      throw new Error('COMPOSIO_API_KEY is required for tool execution');
    }
    
    this.composioToolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
    });
    
    console.log('✅ ReactAgentManager initialized with OpenAI and Composio');
  }

  allocatePort() {
    for (let port = this.portRange.min; port <= this.portRange.max; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available ports in range');
  }

  deallocatePort(port) {
    this.usedPorts.delete(port);
  }

  generateSystemPrompt(appName, tools) {
    const toolsList = tools.map(tool => `• ${tool}`).join('\n');
    const currentDateTime = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return `You are an autonomous ${appName} specialist agent in a multi-agent system.

**CURRENT DATE AND TIME**: ${currentDateTime}
Use this information to correctly interpret relative time references like "tomorrow", "next week", "yesterday", etc.

## Your Role:
You are a fully autonomous agent with the ability to execute ${appName} tools directly. You can perform real actions, make API calls, and complete tasks independently.

## Available Tools:
${toolsList}

## Capabilities:
- Execute ${appName} tools directly using Composio
- Make real API calls to ${appName} services
- Create, read, update, and delete ${appName} data
- Communicate with other agents through A2A protocol when needed
- Ask for clarification if task requirements are unclear

## Behavior Guidelines:
1. **Autonomous Execution**: You can and should execute tools directly to complete tasks
2. **Confirmation**: For destructive operations (delete, permanent changes), ask for confirmation first
3. **Tool Usage**: Use the appropriate tools based on the user's request
4. **Error Handling**: If a tool fails, try alternative approaches or ask for clarification
5. **Communication**: You can communicate with other agents if you need information outside your domain
6. **Results**: Always provide clear feedback about what actions you took and their results

## Response Format:
- Execute the necessary tools to complete the task
- Provide clear status updates during execution
- Report final results with "TASK COMPLETED: [summary]"
- If you need input from other agents, use A2A communication

## Inter-Agent Communication:
You can communicate with other specialized agents when needed:
- Google Calendar Agent: For calendar/scheduling tasks
- Gmail Agent: For email operations  
- Other domain specialists as available

Remember: You are autonomous and should execute tools directly to complete ${appName} tasks efficiently.`;
  }

  async createComposioTools(actions, userId = DEFAULT_COMPOSIO_ENTITY_ID) {
    try {
      console.log(`[ReactAgentManager] Creating Composio tools for actions: ${actions.join(', ')} with userId: ${userId}`);
      
      // Get Composio tools
      const composioTools = await this.composioToolset.getTools({
        actions: actions,
      });
      
      // Convert to LangChain tools
      const langchainTools = composioTools.map(tool => {
        return new DynamicStructuredTool({
          name: tool.function.name,
          description: tool.function.description,
          schema: z.object(
            Object.entries(tool.function.parameters?.properties || {}).reduce((acc, [key, value]) => {
              // Convert OpenAI schema to Zod schema
              if (value.type === 'string') {
                acc[key] = value.enum ? z.enum(value.enum) : z.string();
              } else if (value.type === 'number') {
                acc[key] = z.number();
              } else if (value.type === 'boolean') {
                acc[key] = z.boolean();
              } else if (value.type === 'array') {
                // Handle array schema properly with items
                if (value.items) {
                  if (value.items.type === 'string') {
                    acc[key] = value.items.enum ? z.array(z.enum(value.items.enum)) : z.array(z.string());
                  } else if (value.items.type === 'number') {
                    acc[key] = z.array(z.number());
                  } else if (value.items.type === 'boolean') {
                    acc[key] = z.array(z.boolean());
                  } else {
                    acc[key] = z.array(z.any());
                  }
                } else {
                  // If no items specified, use string array as default
                  acc[key] = z.array(z.string());
                }
              } else {
                acc[key] = z.any();
              }
              
              if (!tool.function.parameters?.required?.includes(key)) {
                acc[key] = acc[key].optional();
              }
              
              return acc;
            }, {})
          ),
          func: async (args) => {
            try {
              console.log(`[Tool Execution] ${tool.function.name}:`, args);
              
              // Execute the tool using Composio
              // Composio expects the tool call in a specific format
              const toolCall = {
                id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'function',
                function: {
                  name: tool.function.name,
                  arguments: JSON.stringify(args)
                }
              };
              
              const result = await this.composioToolset.executeToolCall(
                toolCall,
                userId
              );
              
              console.log(`[Tool Result] ${tool.function.name}:`, result);
              return JSON.stringify(result);
              
            } catch (error) {
              console.error(`[Tool Error] ${tool.function.name}:`, error);
              return `Error executing ${tool.function.name}: ${error.message}`;
            }
          }
        });
      });
      
      console.log(`[ReactAgentManager] Created ${langchainTools.length} LangChain tools`);
      return langchainTools;
      
    } catch (error) {
      console.error('[ReactAgentManager] Error creating Composio tools:', error);
      return [];
    }
  }

  async createInterAgentTools(agentId, appName) {
    // Tools for communicating with other agents
    const discoverAgentsTool = new DynamicStructuredTool({
      name: "discover_other_agents",
      description: "Discover other specialized agents in the system that you can communicate with",
      schema: z.object({
        appFilter: z.string().optional().describe("Filter agents by app name (optional)")
      }),
      func: async (args) => {
        try {
          const agents = this.listAgents(args.appFilter);
          const otherAgents = agents.filter(agent => agent.id !== agentId);
          
          return JSON.stringify({
            agents: otherAgents.map(agent => ({
              id: agent.id,
              name: agent.name,
              appName: agent.appName,
              description: agent.description,
              url: agent.url
            }))
          });
        } catch (error) {
          return `Error discovering agents: ${error.message}`;
        }
      }
    });

    const communicateWithAgentTool = new DynamicStructuredTool({
      name: "communicate_with_agent",
      description: "Send a message to another specialized agent to get information or coordinate tasks",
      schema: z.object({
        agentId: z.string().describe("ID of the agent to communicate with"),
        message: z.string().describe("Message to send to the agent")
      }),
      func: async (args) => {
        try {
          const targetAgent = this.getAgent(args.agentId);
          if (!targetAgent) {
            return `Agent with ID ${args.agentId} not found`;
          }

          // Create A2A client to communicate with the target agent
          const client = new A2AClient(targetAgent.url);
          
          // A2A SDK expects parts to have 'kind' property with 'text' content
          const userMessage = {
            role: 'user',
            parts: [{ kind: 'text', text: args.message }]
          };

          const taskId = `inter-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const response = await client.sendTask({
            id: taskId,
            message: userMessage
          });

          if (response?.message?.parts?.[0]?.text) {
            return response.message.parts[0].text;
          } else {
            return `Agent ${args.agentId} did not provide a valid response`;
          }
          
        } catch (error) {
          return `Error communicating with agent: ${error.message}`;
        }
      }
    });

    return [discoverAgentsTool, communicateWithAgentTool];
  }

  async createAgent(agentId, appName, actions, systemPrompt, userId = DEFAULT_COMPOSIO_ENTITY_ID) {
    try {
      const port = this.allocatePort();
      
      console.log(`[ReactAgentManager] Creating React agent ${agentId} for ${appName} with actions: ${actions.join(', ')}`);
      
      // Create Composio tools for this agent
      const composioTools = await this.createComposioTools(actions, userId);
      
      // Create inter-agent communication tools
      const interAgentTools = await this.createInterAgentTools(agentId, appName);
      
      // Combine all tools
      const allTools = [...composioTools, ...interAgentTools];
      
      console.log(`[ReactAgentManager] Agent ${agentId} tools breakdown:`);
      console.log(`  - Composio tools: ${composioTools.length} (${actions.join(', ')})`);
      console.log(`  - Inter-agent tools: ${interAgentTools.length} (discover_other_agents, communicate_with_agent)`);
      console.log(`  - Total tools: ${allTools.length}`);
      
      // Create React agent with memory
      const memory = new MemorySaver();
      const reactAgent = createReactAgent({
        llm: this.llm,
        tools: allTools,
        checkpointSaver: memory,
        messageModifier: systemPrompt || this.generateSystemPrompt(appName, actions)
      });
      
      // Create task handler that uses the React agent
      const taskHandler = async function* (executionContext) {
        console.log(`[Agent ${agentId}] Processing task with React agent. Execution context keys:`, Object.keys(executionContext));
        
        // Get request parameters from execution context (A2A SDK format)
        const requestParams = executionContext.getRequestParams();
        console.log(`[Agent ${agentId}] Request params:`, JSON.stringify(requestParams, null, 2));
        
        // Extract user message from request parameters
        const userMessage = requestParams.message;
        console.log(`[Agent ${agentId}] User message:`, JSON.stringify(userMessage, null, 2));
        
        // Extract text from user message (A2A format)
        let userInput = '';
        if (userMessage && userMessage.parts && Array.isArray(userMessage.parts)) {
          userInput = userMessage.parts
            .filter(part => part.kind === 'text' && part.text) // A2A parts have 'kind' and 'text' properties
            .map(part => part.text)
            .join(' ');
        } else if (typeof userMessage === 'string') {
          userInput = userMessage;
        } else if (userMessage && userMessage.text) {
          userInput = userMessage.text;
        } else {
          userInput = 'Hello! How can I help you?'; // Fallback
        }
          
        console.log(`[Agent ${agentId}] Received user input:`, userInput);

        // Yield working state
        yield {
          kind: 'status-update',
          taskId: requestParams.message.taskId,
          status: {
            state: 'working',
            message: {
              kind: 'message',
              messageId: `working-${Date.now()}`,
              role: 'agent',
              parts: [{ kind: 'text', text: `${appName} agent is processing your request...` }]
            }
          }
        };

        // Check for cancellation
        if (executionContext.isCancelled()) {
          yield {
            kind: 'status-update',
            taskId: requestParams.message.taskId,
            status: {
              state: 'completed',
              message: {
                kind: 'message',
                messageId: `cancelled-${Date.now()}`,
                role: 'agent',
                parts: [{ kind: 'text', text: 'Task was cancelled.' }]
              }
            }
          };
          return;
        }

        try {
          // Create unique thread ID for this conversation
          const threadId = `thread-${agentId}-${Date.now()}`;
          
          // Execute the React agent
          const agentResponse = await reactAgent.invoke(
            { messages: [{ role: 'user', content: userInput }] },
            { configurable: { thread_id: threadId } }
          );
          
          // Extract the final response
          const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
          const responseText = lastMessage?.content || 'Task completed successfully';
          
          console.log(`[Agent ${agentId}] React agent response:`, responseText);

          // Yield completed state with response (A2A format)
          yield {
            kind: 'status-update',
            taskId: requestParams.message.taskId,
            status: {
              state: 'completed',
              message: {
                kind: 'message',
                messageId: `completed-${Date.now()}`,
                role: 'agent',
                parts: [{ kind: 'text', text: responseText }]
              }
            }
          };
          
          console.log(`[Agent ${agentId}] Task completed, response length: ${responseText.length} chars`);

        } catch (error) {
          console.error(`[Agent ${agentId}] Error with React agent:`, error);
          const errorText = `Error processing task: ${error.message}. Please try again or rephrase your request.`;
          
          yield {
            kind: 'status-update',
            taskId: requestParams.message.taskId,
            status: {
              state: 'completed',
              message: {
                kind: 'message',
                messageId: `error-${Date.now()}`,
                role: 'agent',
                parts: [{ kind: 'text', text: errorText }]
              }
            }
          };
          
          console.log(`[Agent ${agentId}] Error response sent: ${errorText}`);
        }
      };

      // Create A2A Server
      const server = new A2AServer({
        handler: taskHandler,
        taskStore: new InMemoryTaskStore(),
        port: port,
        basePath: '/a2a',
        corsOptions: {
          origin: '*',
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type']
        },
        card: {
          name: `${appName} React Agent`,
          url: `http://localhost:${port}/a2a`,
          version: '1.0.0',
          description: `Autonomous React agent for ${appName} with ${actions.length} tools and inter-agent communication`,
          capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: true
          },
          skills: actions.map(action => ({
            id: action.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            name: action,
            description: `${action} functionality for ${appName}`
          }))
        }
      });

      // Start the server
      await server.start();
      console.log(`[ReactAgentManager] Created React agent ${agentId} for ${appName} on port ${port}`);

      // Store agent info
      const agentInfo = {
        id: agentId,
        appName,
        name: `${appName} React Agent`,
        description: `Autonomous React agent for ${appName} with tools: ${actions.join(', ')}`,
        url: `http://localhost:${port}/a2a`,
        port,
        actions,
        tools: allTools,
        reactAgent,
        server,
        created: new Date(),
        systemPrompt: systemPrompt || this.generateSystemPrompt(appName, actions),
        userId: userId || DEFAULT_COMPOSIO_ENTITY_ID
      };

      this.agents.set(agentId, agentInfo);
      return agentInfo;

    } catch (error) {
      console.error(`[ReactAgentManager] Error creating React agent ${agentId}:`, error);
      throw error;
    }
  }

  async destroyAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    try {
      // Stop the A2A server
      await agent.server.stop();
      console.log(`[ReactAgentManager] Stopped server for agent ${agentId}`);

      // Deallocate port
      this.deallocatePort(agent.port);

      // Remove from storage
      this.agents.delete(agentId);
      
      console.log(`[ReactAgentManager] Destroyed React agent ${agentId}`);
      return true;

    } catch (error) {
      console.error(`[ReactAgentManager] Error destroying agent ${agentId}:`, error);
      throw error;
    }
  }

  listAgents(appNameFilter = null) {
    const agents = Array.from(this.agents.values());
    
    if (appNameFilter) {
      return agents.filter(agent => 
        agent.appName.toLowerCase().includes(appNameFilter.toLowerCase())
      );
    }
    
    return agents;
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

// Initialize React agent manager
console.log('🔄 Initializing ReactAgentManager...');
const agentManager = new ReactAgentManager();
console.log('✅ ReactAgentManager initialized');

// API Routes
console.log('🔄 Setting up API routes...');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    agents: agentManager.listAgents().length,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    composioConfigured: !!process.env.COMPOSIO_API_KEY,
    agentType: 'LangChain React Agents'
  });
});

// Create or update agent
app.post('/api/agents', async (req, res) => {
  try {
    const { agentId, appName, actions, systemPrompt, userId } = req.body;
    
    if (!agentId || !appName || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentId, appName, actions (array)' 
      });
    }

    console.log(`[API] Creating/updating React agent: ${agentId} for ${appName} with userId: ${userId || DEFAULT_COMPOSIO_ENTITY_ID}`);

    // Check if agent already exists and needs updating
    const existingAgent = agentManager.getAgent(agentId);
    if (existingAgent) {
      // Compare actions and system prompt to see if update is needed
      const actionsChanged = !arraysEqual(existingAgent.actions, actions);
      const promptChanged = existingAgent.systemPrompt !== (systemPrompt || agentManager.generateSystemPrompt(appName, actions));
      
      if (!actionsChanged && !promptChanged) {
        console.log(`[API] Agent ${agentId} already exists with same configuration, skipping creation`);
        return res.json({
          success: true,
          agent: {
            id: existingAgent.id,
            appName: existingAgent.appName,
            name: existingAgent.name,
            description: existingAgent.description,
            url: existingAgent.url,
            actions: existingAgent.actions,
            created: existingAgent.created
          },
          updated: false
        });
      }

      // Actions or prompt changed, destroy existing agent
      console.log(`[API] Agent ${agentId} configuration changed, recreating...`);
      await agentManager.destroyAgent(agentId);
    }

    const agent = await agentManager.createAgent(agentId, appName, actions, systemPrompt, userId);
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        appName: agent.appName,
        name: agent.name,
        description: agent.description,
        url: agent.url,
        actions: agent.actions,
        created: agent.created
      },
      updated: !!existingAgent
    });

  } catch (error) {
    console.error('[API] Error creating agent:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to create React agent'
    });
  }
});

// List agents
app.get('/api/agents', (req, res) => {
  try {
    const { appName } = req.query;
    const agents = agentManager.listAgents(appName);
    
    res.json({
      success: true,
      agents: agents.map(agent => ({
        id: agent.id,
        appName: agent.appName,
        name: agent.name,
        description: agent.description,
        url: agent.url,
        actions: agent.actions,
        created: agent.created,
        status: 'active'
      }))
    });

  } catch (error) {
    console.error('[API] Error listing agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete agent
app.delete('/api/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const success = await agentManager.destroyAgent(agentId);
    
    if (success) {
      res.json({ success: true, message: `Agent ${agentId} destroyed` });
    } else {
      res.status(404).json({ error: `Agent ${agentId} not found` });
    }

  } catch (error) {
    console.error('[API] Error destroying agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delegate task to agent
app.post('/api/agents/:agentId/delegate', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: `Agent ${agentId} not found` });
    }

    console.log(`[API] Delegating task to React agent ${agentId}:`, message);
    if (userId) {
      console.log(`[API] Note: userId ${userId} provided but agent tools already configured with userId: ${agent.userId}`);
    }

    // Create A2A client to communicate with the agent
    const client = new A2AClient(agent.url);
    
    // A2A SDK expects parts to have 'kind' property with 'text' content
    const userMessage = {
      role: 'user',
      parts: [{ kind: 'text', text: message }]
    };

    const taskId = `delegate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[API] Sending A2A message:`, userMessage);
    
    const response = await client.sendTask({
      id: taskId,
      message: userMessage
    });

    console.log(`[API] A2A response received:`, JSON.stringify(response, null, 2));

    // A2A response structure: response.status.message.parts[0].text
    if (response?.status?.message?.parts?.[0]?.text) {
      res.json({
        success: true,
        response: response.status.message.parts[0].text
      });
    } else if (response?.message?.parts?.[0]?.text) {
      // Fallback to old structure just in case
      res.json({
        success: true,
        response: response.message.parts[0].text
      });
    } else {
      console.log(`[API] Invalid response format. Expected status.message.parts[0].text, got:`, response);
      res.json({
        success: false,
        error: 'Agent did not provide a valid response',
        debug: response
      });
    }

  } catch (error) {
    console.error('[API] Error delegating to agent:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 A2A Backend Server with React Agents running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Ready to create autonomous React agents!`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down A2A Backend Server...');
  
  // Destroy all agents
  const agents = agentManager.listAgents();
  for (const agent of agents) {
    try {
      await agentManager.destroyAgent(agent.id);
    } catch (error) {
      console.error(`Error destroying agent ${agent.id}:`, error);
    }
  }
  
  console.log('✅ All agents destroyed');
  console.log('👋 A2A Backend Server shut down gracefully');
  process.exit(0);
});
