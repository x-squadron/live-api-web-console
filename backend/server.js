import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import multer from 'multer';
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
import { createLinearAgent, runLinearMeetingAgent } from './LinearMeetingAgent.js';
import { SwarmManager, MeetingSummarizer } from './swarm/index.js';
import { MultiSwarmManager, AgentFactory } from './swarm/index.js';
import logger from './utils/logger.js';
// Upstash Workflows replaces QStash queues
import workflow from './workflows/agentic.workflow.js';
import { acquire as acquireIdem, done as doneIdem } from './workflows/utils/idempotency.js';

console.log('🔄 Starting A2A Backend Server with LangChain React Agents...');
logger.logSystemEvent('Server startup initiated');

// Load environment variables
dotenv.config();
console.log('✅ Environment variables loaded');
logger.logSystemEvent('Environment variables loaded');

// Configure logging
configureLogger({ level: 'info' });
console.log('✅ Artinet SDK logger configured');
logger.logSystemEvent('Artinet SDK logger configured');

const app = express();
const PORT = process.env.PORT || 3001;
console.log(`✅ Express app created, will use port ${PORT}`);
logger.logSystemEvent(`Express app created on port ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
console.log('✅ Middleware configured');
logger.logSystemEvent('Middleware configured');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept text files and allow all file types for now
    cb(null, true);
  }
});
console.log('✅ File upload middleware configured');
logger.logSystemEvent('File upload middleware configured');

// Upstash QStash removed. Workflows are used instead.

// In-memory job store (DEV/initial). Replace with Redis/DB for production.
const jobs = new Map();

function createJob(initialData = {}) {
  const jobId = uuidv4();
  const now = new Date().toISOString();
  const job = {
    id: jobId,
    status: 'queued', // queued | running | completed | failed
    progress: 0,
    createdAt: now,
    updatedAt: now,
    result: null,
    error: null,
    meta: initialData
  };
  jobs.set(jobId, job);
  return job;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  // Do not downgrade a finished job
  if (job.status === 'completed' || job.status === 'failed') {
    return job;
  }
  // Prevent progress regression
  const merged = { ...job, ...updates };
  if (typeof updates?.progress === 'number' && typeof job.progress === 'number') {
    merged.progress = Math.max(job.progress, updates.progress);
  }
  const next = { ...merged, updatedAt: new Date().toISOString() };
  jobs.set(jobId, next);
  return next;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

// Idempotency mapping: idempotencyKey -> jobId (DEV/initial)
const idempotencyMap = new Map();
function getOrCreateJobForKey(idempotencyKey, createJobFn) {
  if (!idempotencyKey) return null;
  const existing = idempotencyMap.get(idempotencyKey);
  if (existing) return existing;
  const job = createJobFn();
  idempotencyMap.set(idempotencyKey, job);
  return job;
}

// API Request/Response Logging Middleware
app.use((req, res, next) => {
  // Log request
  logger.logApiRequest(req.method, req.path, req.body, req.headers);
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    logger.logApiResponse(req.method, req.path, res.statusCode, data);
    return originalJson.call(this, data);
  };
  
  next();
});

// Default Composio Entity ID for tool execution (can be overridden per request)
const DEFAULT_COMPOSIO_ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || 'default_user';

// Store for managing dynamic React agents
class ReactAgentManager {
  constructor() {
    this.agents = new Map();
    this.standaloneAgents = new Map(); // Add support for standalone agents
    this.portRange = { min: 4000, max: 4999 };
    this.usedPorts = new Set();
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for React agents');
    }
    
    this.llm = new ChatOpenAI({
      modelName: "gpt-5-mini-2025-08-07",
      temperature: 1,
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

  // Register a standalone agent
  registerStandaloneAgent(agentConfig) {
    const agentInfo = {
      id: agentConfig.id,
      name: agentConfig.name,
      description: agentConfig.description,
      url: agentConfig.url,
      appName: agentConfig.appName || 'Standalone',
      actions: agentConfig.tools || [],
      status: 'active',
      type: 'standalone',
      created: new Date(),
      lastUsed: new Date(),
      agent: agentConfig.agent, // Store the actual agent instance
      discoverable: true // Default discoverable
    };
    
    this.standaloneAgents.set(agentConfig.id, agentInfo);
    console.log(`✅ Registered standalone agent: ${agentConfig.name}`);
    return agentInfo;
  }

  listAgents(appNameFilter = null) {
    // Get dynamic agents
    const dynamicAgents = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      url: agent.url,
      appName: agent.appName,
      actions: agent.actions,
      status: 'active',
      type: 'dynamic',
      created: agent.created,
      discoverable: agent.discoverable !== false
    }));

    // Get standalone agents
    const standaloneAgents = Array.from(this.standaloneAgents.values());
    
    const allAgents = [...dynamicAgents, ...standaloneAgents];
    
    if (appNameFilter) {
      return allAgents.filter(agent => 
        agent.appName.toLowerCase().includes(appNameFilter.toLowerCase())
      );
    }
    
    return allAgents;
  }

  getAgent(agentId) {
    return this.agents.get(agentId) || this.standaloneAgents.get(agentId);
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

// Register some test standalone agents
agentManager.registerStandaloneAgent({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A simple test agent for demonstration',
  url: 'http://localhost:9999',
  appName: 'Test App',
  tools: ['say_hello', 'get_time', 'echo_message']
});

agentManager.registerStandaloneAgent({
  id: 'weather-agent',
  name: 'Weather Agent',
  description: 'Provides weather information',
  url: 'http://localhost:9998',
  appName: 'Weather Service',
  tools: ['get_weather', 'get_forecast']
});

// Initialize and register the Linear Meeting Agent
console.log('🔄 Registering Linear Meeting Agent...');
try {
  // Create and initialize the Linear agent
  const linearAgent = createLinearAgent();
  await linearAgent.initialize();
  
  // Register the Linear agent with the agent manager
  agentManager.registerStandaloneAgent({
    id: 'linear-meeting-agent',
    name: 'Linear Meeting Agent',
    description: 'Manages Linear issues based on meeting transcripts, creates subtasks, and adds comments',
    url: 'internal', // This agent runs internally, not as a separate server
    appName: 'Linear Meeting Manager',
    tools: ['LINEAR_LIST_LINEAR_ISSUES', 'LINEAR_LIST_LINEAR_PROJECTS', 'LINEAR_CREATE_LINEAR_ISSUE', 'LINEAR_UPDATE_ISSUE', 'LINEAR_DELETE_LINEAR_ISSUE', 'LINEAR_LIST_LINEAR_TEAMS', 'LINEAR_LIST_LINEAR_STATES', 'LINEAR_CREATE_LINEAR_COMMENT'],
    agent: linearAgent // Pass the actual agent instance
  });
  
  console.log('✅ Linear Meeting Agent registered successfully');
} catch (error) {
  console.error('❌ Failed to register Linear Meeting Agent:', error);
  console.error('Make sure OPENAI_API_KEY and COMPOSIO_API_KEY are set in environment');
}

// Helper function to format transcript object for the Linear agent
function formatTranscriptForAgent(transcript) {
  const { id, platform, native_meeting_id, constructed_meeting_url, status, start_time, end_time, segments } = transcript;
  
  // Create meeting metadata section
  const metadata = [
    `MEETING METADATA:`,
    `- Meeting ID: ${id}`,
    `- Platform: ${platform}`,
    `- Native Meeting ID: ${native_meeting_id}`,
    `- Meeting URL: ${constructed_meeting_url}`,
    `- Status: ${status}`,
    `- Start Time: ${start_time}`,
    `- End Time: ${end_time}`,
    `- Duration: ${segments.length} segments`,
    ``
  ].join('\n');
  
  // Create transcript content section
  const transcriptContent = [
    `TRANSCRIPT CONTENT:`,
    ``
  ];
  
  // Group segments by speaker and format them
  let currentSpeaker = null;
  let speakerSegments = [];
  
  segments.forEach((segment, index) => {
    const speaker = segment.speaker || 'Unknown Speaker';
    const text = segment.text.trim();
    const timestamp = `[${Math.floor(segment.start)}s-${Math.floor(segment.end)}s]`;
    
    if (speaker !== currentSpeaker) {
      // Finish previous speaker's segments
      if (currentSpeaker && speakerSegments.length > 0) {
        transcriptContent.push(`${currentSpeaker}:`);
        transcriptContent.push(speakerSegments.join(' '));
        transcriptContent.push('');
      }
      
      // Start new speaker
      currentSpeaker = speaker;
      speakerSegments = [`${timestamp} ${text}`];
    } else {
      // Continue with same speaker
      speakerSegments.push(`${timestamp} ${text}`);
    }
  });
  
  // Add the last speaker's segments
  if (currentSpeaker && speakerSegments.length > 0) {
    transcriptContent.push(`${currentSpeaker}:`);
    transcriptContent.push(speakerSegments.join(' '));
    transcriptContent.push('');
  }
  
  // Add analysis hints for the agent
  const analysisHints = [
    `ANALYSIS GUIDELINES:`,
    `- Extract action items, tasks, and decisions from the conversation`,
    `- Look for references to existing Linear issues or project work`,
    `- Identify new features, bugs, or improvements discussed`,
    `- Note any deadlines, priorities, or assignments mentioned`,
    `- Consider the context and technical nature of the discussion`,
    `- Create appropriate Linear issues for actionable items`,
    ``
  ].join('\n');
  
  return [metadata, transcriptContent.join('\n'), analysisHints].join('\n');
}

// API Routes
console.log('🔄 Setting up API routes...');
// Orchestration trigger endpoint (replaces queue publish)
app.post('/orchestrate/agentic', async (req, res) => {
  try {
    const { tenantId, sessionId, flowType, payload } = req.body || {};
    if (!tenantId || !sessionId) {
      return res.status(400).json({ success: false, error: 'tenantId and sessionId are required' });
    }
    const run = await workflow.trigger({ tenantId, sessionId, flowType: flowType || 'default', payload });
    return res.status(202).json({ success: true, status: 'accepted', runId: run.runId || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Internal workflow step endpoints used by Upstash Workflows
app.post('/internal/workflow/summary', async (req, res) => {
  try {
    const { transcript, text, meetingId } = req.body || {};
    if (!transcript && !text) {
      return res.status(400).json({ success: false, error: 'transcript or text is required' });
    }
    const processed = transcript ? transcript : processTextInput(text);
    const result = await meetingSummarizer.processCompleteWorkflow(processed, meetingId || `meeting_${Date.now()}`);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message });
  }
});

app.post('/internal/workflow/analysis', async (req, res) => {
  try {
    const { meetingId, actionItems } = req.body || {};
    if (!meetingId) {
      return res.status(400).json({ success: false, error: 'meetingId is required' });
    }
    const baseItems = actionItems || 'No specific action items extracted';
    const result = await meetingSummarizer.analyzeActionItemsWithContext(baseItems, meetingId);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message });
  }
});

app.post('/internal/workflow/exec', async (req, res) => {
  try {
    const { meetingId, analysis, userId } = req.body || {};
    if (!meetingId || !analysis) {
      return res.status(400).json({ success: false, error: 'meetingId and analysis are required' });
    }
    let linearOperations = null;
    try {
      const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      linearOperations = (parsed.linear_operations || []).filter(op => {
        if (!op) return false;
        const opType = op.operation;
        if (opType === 'create_issue' || opType === 'create_subtask') return true;
        const conf = typeof op.matching_confidence === 'number' ? op.matching_confidence : 1;
        return conf >= 0.7;
      });
    } catch {}
    const executionPrompt = linearOperations
      ? `You will receive a JSON array of Linear operations to execute. Follow EXACTLY and map desired_state_name/state_category to state_id via LINEAR_LIST_LINEAR_STATES. Only update/comment existing issues if matching_confidence >= 0.7. Here are the operations:\n\n${JSON.stringify(linearOperations, null, 2)}`
      : `EXECUTE THESE SPECIFIC LINEAR OPERATIONS BASED ON ANALYSIS (raw):\n\n${typeof analysis === 'string' ? analysis : JSON.stringify(analysis)}`;
    const execResult = await multiSwarmManager.processWithSwarm('project-management', executionPrompt, userId || 'default_user');
    if (!execResult.success) {
      return res.json({ success: false, error: execResult.error });
    }
    return res.json({ success: true, result: execResult.result });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message });
  }
});

app.post('/internal/workflow/persist', async (req, res) => {
  try {
    const { jobId, data, status } = req.body || {};
    if (jobId) {
      updateJob(jobId, { status: status || 'completed', progress: 100, result: data });
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message });
  }
});

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

// Register standalone agent
app.post('/api/agents/register', (req, res) => {
  try {
    const { id, name, description, url, appName, tools } = req.body;
    
    if (!id || !name || !url) {
      return res.status(400).json({ 
        success: false, 
        error: 'id, name, and url are required' 
      });
    }

    const agentInfo = agentManager.registerStandaloneAgent({
      id, name, description, url, appName, tools
    });

    res.json({ 
      success: true, 
      agent: agentInfo 
    });
  } catch (error) {
    console.error('Error registering standalone agent:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// List agents
app.get('/api/agents', (req, res) => {
  try {
    const { appName, includeUndiscoverable } = req.query;
    const agents = agentManager.listAgents(appName);
    
    // Filter out undiscoverable agents unless explicitly requested
    const filteredAgents = includeUndiscoverable === 'true' 
      ? agents 
      : agents.filter(agent => {
          const a = ensureDiscoverable(agent);
          return a.discoverable !== false;
        });
    
    console.log(`[API] Listing agents: found ${agents.length} total, returning ${filteredAgents.length} discoverable`);
    
    res.json({
      success: true,
      agents: filteredAgents.map(agent => {
        const a = ensureDiscoverable(agent);
        return {
          id: a.id,
          appName: a.appName,
          name: a.name,
          description: a.description,
          url: a.url,
          actions: a.actions,
          created: a.created,
          discoverable: a.discoverable !== false,
          status: 'active',
        };
      })
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

    // Handle standalone agents differently - call their actual methods
    if (agent.type === 'standalone' && agent.agent) {
      console.log(`[API] Delegating task to standalone agent ${agentId}:`, message);
      
      try {
        // Call the agent's invoke method directly
        const result = await agent.agent.invoke(message);
        
        return res.json({
          success: true,
          response: result.output || result
        });
      } catch (error) {
        console.error(`[API] Error invoking standalone agent ${agentId}:`, error);
        return res.status(500).json({
          success: false,
          error: `Agent error: ${error.message}`
        });
      }
    } else if (agent.type === 'standalone') {
      // Fallback for standalone agents without actual agent instance
      console.log(`[API] Delegating task to standalone agent ${agentId}:`, message);
      const mockResponse = `Hello! I'm ${agent.name}. I received your message: "${message}". This is a mock response since I'm a standalone agent. Available tools: ${agent.actions.join(', ')}`;
      
      return res.json({
        success: true,
        response: mockResponse
      });
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

// New meeting transcript endpoint
app.post('/api/meeting/transcript', async (req, res) => {
  try {
    const { meetingId, transcript } = req.body;
    
    // Validate required fields
    if (!meetingId || !transcript) {
      return res.status(400).json({ 
        error: 'Missing required fields: meetingId and transcript are required' 
      });
    }

    // Validate field types and structure
    if (typeof meetingId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid meetingId: must be a string' 
      });
    }

    if (typeof transcript !== 'object' || !transcript.segments || !Array.isArray(transcript.segments)) {
      return res.status(400).json({ 
        error: 'Invalid transcript: must be an object with a segments array' 
      });
    }

    console.log(`[Meeting API] Processing transcript for meeting ${meetingId}`);
    console.log(`[Meeting API] Transcript has ${transcript.segments.length} segments`);
    
    // Convert transcript object to formatted string for the agent
    const formattedTranscript = formatTranscriptForAgent(transcript);
    
    // Call the Linear meeting agent function with formatted transcript
    const result = await runLinearMeetingAgent({ 
      meetingId, 
      transcript: formattedTranscript
    });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        meetingId: result.meetingId,
        output: result.output,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Agent processing failed',
        meetingId: result.meetingId,
        timestamp: result.timestamp
      });
    }

  } catch (error) {
    console.error('[Meeting API] Error processing transcript:', error);
    res.status(500).json({ 
      error: 'Agent processing failed',
      details: error.message 
    });
  }
});

// Linear Meeting Agent specific endpoints
app.post('/api/linear/process-transcript', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const linearAgent = agentManager.getAgent('linear-meeting-agent');
    if (!linearAgent?.agent) {
      return res.status(404).json({ error: 'Linear Meeting Agent not available' });
    }

    console.log(`[Linear API] Processing meeting transcript...`);
    const result = await linearAgent.agent.processMeeting(transcript);
    
    res.json(result);

  } catch (error) {
    console.error('[Linear API] Error processing transcript:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/linear/issues', async (req, res) => {
  try {
    const linearAgent = agentManager.getAgent('linear-meeting-agent');
    if (!linearAgent?.agent) {
      return res.status(404).json({ error: 'Linear Meeting Agent not available' });
    }

    const result = await linearAgent.agent.invoke('List all Linear issues for the Faktions project using LINEAR_LIST_LINEAR_ISSUES');
    res.json(result);

  } catch (error) {
    console.error('[Linear API] Error listing issues:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/linear/teams', async (req, res) => {
  try {
    const linearAgent = agentManager.getAgent('linear-meeting-agent');
    if (!linearAgent?.agent) {
      return res.status(404).json({ error: 'Linear Meeting Agent not available' });
    }

    const result = await linearAgent.agent.invoke('Get team information for the Faktions project using LINEAR_LIST_LINEAR_TEAMS');
    res.json(result);

  } catch (error) {
    console.error('[Linear API] Error listing teams:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/linear/issues', async (req, res) => {
  try {
    const { title, description, priority, teamId, parentId } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const linearAgent = agentManager.getAgent('linear-meeting-agent');
    if (!linearAgent?.agent) {
      return res.status(404).json({ error: 'Linear Meeting Agent not available' });
    }

    let prompt = `Create a Linear issue with the following details:
- Title: "${title}"
- Description: "${description}"`;
    
    if (priority) prompt += `\n- Priority: ${priority}`;
    if (teamId) prompt += `\n- Team ID: ${teamId}`;
    if (parentId) prompt += `\n- Parent ID: ${parentId} (create as subtask)`;
    
    prompt += '\n\nUse the appropriate Linear tools to create this issue.';

    const result = await linearAgent.agent.invoke(prompt);
    res.json(result);

  } catch (error) {
    console.error('[Linear API] Error creating issue:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Patch 3: Add toggle-discoverable endpoint
app.post('/api/agents/:id/toggle-discoverable', (req, res) => {
  try {
    console.log(`[API] Toggling discoverable status for agent: ${req.params.id}`);
    
    const agent = agentManager.getAgent(req.params.id);
    if (!agent) {
      console.log(`[API] Agent not found: ${req.params.id}`);
      return res.status(404).json({ error: "Agent not found" });
    }

    console.log(`[API] Current discoverable status: ${agent.discoverable}`);
    agent.discoverable = !agent.discoverable;
    console.log(`[API] New discoverable status: ${agent.discoverable}`);
    
    res.json({ success: true, discoverable: agent.discoverable });
  } catch (error) {
    console.error(`[API] Error toggling agent discoverable status:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SWARM AGENTS SERVICE =====

// Initialize Swarm Manager and Meeting Summarizer
console.log('🔄 Initializing Swarm Manager...');
const swarmManager = new SwarmManager();

console.log('🔄 Initializing Meeting Summarizer...');
const meetingSummarizer = new MeetingSummarizer();
console.log('✅ Swarm Manager initialized');

// Swarm endpoints

// Example: Add logging middleware for all requests
app.use((req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
  console.log(`[SwarmAPI][Request] ${req.method} ${req.originalUrl} | Params: ${JSON.stringify(req.params)} | Query: ${JSON.stringify(req.query)} | Body:`, body && body.length > 500 ? body.slice(0, 500) + '...[truncated]' : body);
  next();
});

// Get all available agents in the swarm
app.get('/api/swarm/agents', (req, res) => {
  try {
    console.log('[SwarmAPI] Getting all available agents');
    
    const agents = swarmManager.getAllAgentsInfo();
    
    res.json({
      success: true,
      agents: agents,
      availableAgents: swarmManager.getAvailableAgents(),
      totalAgents: swarmManager.getAvailableAgents().length
    });
    
  } catch (error) {
    console.error('[SwarmAPI] Error getting agents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific agent information
app.get('/api/swarm/agents/:agentType', (req, res) => {
  try {
    const { agentType } = req.params;
    console.log(`[SwarmAPI] Getting agent info for: ${agentType}`);
    
    const agentInfo = swarmManager.getAgentInfo(agentType);
    
    if (agentInfo.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: `Agent type '${agentType}' not found`,
        availableAgents: swarmManager.getAvailableAgents()
      });
    }
    
    res.json({
      success: true,
      agent: agentInfo
    });
    
  } catch (error) {
    console.error(`[SwarmAPI] Error getting agent info for ${req.params.agentType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process request with specific agent
app.post('/api/swarm/agents/:agentType/process', async (req, res) => {
  try {
    const { agentType } = req.params;
    const { request, meetingId } = req.body;
    
    if (!request) {
      return res.status(400).json({
        success: false,
        error: 'Request content is required'
      });
    }
    
    console.log(`[SwarmAPI] Processing request with ${agentType} agent:`, request);
    
    const result = await swarmManager.routeRequest(agentType, request);
    
    if (result.success) {
      res.json({
        success: true,
        agentType: result.agentType,
        result: result.result,
        meetingId: meetingId || null,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        agentType: result.agentType,
        error: result.error,
        meetingId: meetingId || null,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[SwarmAPI] Error processing request with ${req.params.agentType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Process meeting transcript with specific agent
app.post('/api/swarm/agents/:agentType/process-transcript', async (req, res) => {
  try {
    const { agentType } = req.params;
    const { transcript, meetingId, userId } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }
    
    console.log(`[SwarmAPI] Processing meeting transcript with ${agentType} agent for meeting ${meetingId}`);
    
    // Use the new swarm method for processing meeting transcripts
    const result = await swarmManager.processMeetingTranscript(agentType, transcript, meetingId, userId);
    
    if (result.success) {
      res.json({
        success: true,
        agentType: result.agentType,
        meetingId: result.meetingId,
        result: result.result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        agentType: result.agentType,
        meetingId: result.meetingId,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[SwarmAPI] Error processing meeting transcript with ${agentType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      meetingId: req.body.meetingId || null,
      timestamp: new Date().toISOString()
    });
  }
});

// New dedicated endpoint: Process transcript with LLM summarizer then send to swarm
app.post('/api/swarm/process-transcript-with-summary', async (req, res) => {
  const startTime = Date.now();
  try {
    let { transcript, meetingId, agentType, userId } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }
    
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        error: 'Meeting ID is required'
      });
    }
    
    // Default agentType to 'linear' if not provided
    if (!agentType) {
      agentType = 'linear';
    }
    // Default userId to 'test_user' if not provided
    if (!userId) {
      userId = 'test_user';
    }
    
    console.log(`[SwarmAPI] Processing transcript with summarizer for meeting ${meetingId} using ${agentType} agent`);
    
    // Step 1: Process transcript with summarizer
    const summaryResult = await meetingSummarizer.processCompleteWorkflow(transcript, meetingId);
    
    if (!summaryResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process transcript with summarizer',
        details: summaryResult.error,
        meetingId: meetingId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Step 2: Use MeetingSummarizer's analysis agent to analyze action items with Linear context
    const analysisResult = await meetingSummarizer.analyzeActionItemsWithContext(
      summaryResult,
      finalMeetingId
    );
    
    if (!analysisResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to analyze action items with Linear context',
        details: analysisResult.error,
        meetingId: finalMeetingId,
        timestamp: new Date().toISOString()
      });
    }

    // Step 3: Create execution prompt with specific Linear operations from analysis
    // Prefer JSON parsing to separate Linear ops from Slack-only info
    let linearOperations = null;
    let slackOnlyMessages = [];
    try {
      const parsed = JSON.parse(analysisResult.analysis);
      linearOperations = (parsed.linear_operations || []).filter(op => {
        if (!op) return false;
        const opType = op.operation;
        if (opType === 'create_issue' || opType === 'create_subtask') return true;
        const conf = typeof op.matching_confidence === 'number' ? op.matching_confidence : 1;
        return conf >= 0.7;
      });
      slackOnlyMessages = parsed.slack_only_messages || [];
    } catch (e) {
      // Fallback: if analysis isn't JSON, pass raw content to execution agent
      console.warn('[MultiSwarmAPI] Analysis was not valid JSON; falling back to raw content');
    }

    const executionPrompt = linearOperations
      ? `You will receive a JSON array of Linear operations to execute. Follow EXACTLY and map desired_state_name/state_category to state_id via LINEAR_LIST_LINEAR_STATES. Only update/comment existing issues if matching_confidence >= 0.7. Here are the operations:\n\n${JSON.stringify(linearOperations, null, 2)}`
      : `EXECUTE THESE SPECIFIC LINEAR OPERATIONS BASED ON ANALYSIS (raw):\n\n${analysisResult.analysis}`;

    // Step 4: Send to project management swarm for execution
    const swarmResult = await multiSwarmManager.processWithSwarm('project-management', executionPrompt, finalUserId);
    
    if (swarmResult.success) {
      console.log(`[SwarmAPI][Response] /api/swarm/process-transcript-with-summary | Success | meetingId: ${meetingId} | agentType: ${agentType} | Duration: ${Date.now() - startTime}ms`);
      res.json({
        success: true,
        meetingId: meetingId,
        agentType: agentType,
        summary: {
          formattedTranscript: summaryResult.formattedTranscript,
          summary: summaryResult.summary,
          actionItems: summaryResult.actionItems,
          actionItemsError: summaryResult.actionItemsError
        },
        swarmResult: swarmResult.result,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`[SwarmAPI][Response] /api/swarm/process-transcript-with-summary | Error | meetingId: ${meetingId} | agentType: ${agentType} | Duration: ${Date.now() - startTime}ms | Error: ${swarmResult.error}`);
      res.status(500).json({
        success: false,
        meetingId: meetingId,
        agentType: agentType,
        summary: {
          formattedTranscript: summaryResult.formattedTranscript,
          summary: summaryResult.summary,
          actionItems: summaryResult.actionItems,
          actionItemsError: summaryResult.actionItemsError
        },
        swarmError: swarmResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`[SwarmAPI][Response] /api/swarm/process-transcript-with-summary | Exception | meetingId: ${req.body.meetingId || null} | agentType: ${req.body.agentType || null} | Duration: ${Date.now() - startTime}ms | Error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      meetingId: req.body.meetingId || null,
      timestamp: new Date().toISOString()
    });
  }
});

// Bulk operations for agents
app.post('/api/swarm/agents/:agentType/bulk-create', async (req, res) => {
  try {
    const { agentType } = req.params;
    const { items, userId } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }
    
    console.log(`[SwarmAPI] Bulk creating ${items.length} items with ${agentType} agent`);
    
    // Use the swarm manager to route bulk creation requests
    const bulkPrompt = `
Create the following items in bulk:

${items.map((item, index) => `
Item ${index + 1}:
${JSON.stringify(item, null, 2)}
`).join('\n')}

Please create all these items and provide a summary of what was created.
`;

    const result = await swarmManager.routeRequest(agentType, bulkPrompt, userId);
    
    if (result.success) {
      res.json({
        success: true,
        agentType: result.agentType,
        itemsCount: items.length,
        result: result.result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        agentType: result.agentType,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[SwarmAPI] Error bulk creating items with ${agentType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for swarm
app.get('/api/swarm/health', (req, res) => {
  try {
    const healthInfo = swarmManager.getHealth();
    
    res.json(healthInfo);
    
  } catch (error) {
    console.error('[SwarmAPI] Error checking swarm health:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== MULTI-SWARM MANAGEMENT SERVICE =====

// Initialize Multi-Swarm Manager
console.log('🔄 Initializing Multi-Swarm Manager...');
const multiSwarmManager = new MultiSwarmManager();
const agentFactory = new AgentFactory(multiSwarmManager);

// Set global multiSwarmManager for inter-swarm tools
global.multiSwarmManager = multiSwarmManager;

console.log('✅ Multi-Swarm Manager initialized');

// Multi-swarm endpoints

// Get all swarms
app.get('/api/multi-swarm/swarms', (req, res) => {
  try {
    console.log('[MultiSwarmAPI] Getting all swarms');
    
    const swarms = multiSwarmManager.getAllSwarms();
    
    res.json({
      success: true,
      swarms: swarms,
      totalSwarms: Object.keys(swarms).length
    });
    
  } catch (error) {
    console.error('[MultiSwarmAPI] Error getting swarms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all agents across all swarms
app.get('/api/multi-swarm/agents', (req, res) => {
  try {
    console.log('[MultiSwarmAPI] Getting all agents');
    
    const agents = multiSwarmManager.getAllAgents();
    
    res.json({
      success: true,
      agents: agents,
      totalAgents: Object.keys(agents).length
    });
    
  } catch (error) {
    console.error('[MultiSwarmAPI] Error getting agents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Find agents by capability
app.get('/api/multi-swarm/agents/capability/:capability', (req, res) => {
  try {
    const { capability } = req.params;
    console.log(`[MultiSwarmAPI] Finding agents with capability: ${capability}`);
    
    const agents = multiSwarmManager.findAgentsByCapability(capability);
    
    res.json({
      success: true,
      capability: capability,
      agents: agents,
      count: agents.length
    });
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error finding agents by capability:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new swarm
app.post('/api/multi-swarm/swarms', async (req, res) => {
  try {
    const { swarmId, config } = req.body;
    
    if (!swarmId || !config) {
      return res.status(400).json({
        success: false,
        error: 'Swarm ID and configuration are required'
      });
    }
    
    console.log(`[MultiSwarmAPI] Creating swarm: ${swarmId}`);
    
    const result = multiSwarmManager.createSwarm(swarmId, config);
    
    if (result.success) {
      res.json({
        success: true,
        swarmId: result.swarmId,
        message: `Swarm ${swarmId} created successfully`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error creating swarm:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process request with specific swarm
app.post('/api/multi-swarm/swarms/:swarmId/process', async (req, res) => {
  try {
    const { swarmId } = req.params;
    const { request, userId } = req.body;
    
    if (!request) {
      return res.status(400).json({
        success: false,
        error: 'Request content is required'
      });
    }
    
    console.log(`[MultiSwarmAPI] Processing request with swarm ${swarmId}:`, request);
    
    const result = await multiSwarmManager.processWithSwarm(swarmId, request, userId);
    
    if (result.success) {
      res.json({
        success: true,
        swarmId: result.swarmId,
        response: result.response,
        threadId: result.threadId,
        toolCalls: result.toolCalls,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        swarmId: result.swarmId,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error processing with swarm:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Route request to best swarm
app.post('/api/multi-swarm/route', async (req, res) => {
  try {
    const { request, userId } = req.body;
    
    if (!request) {
      return res.status(400).json({
        success: false,
        error: 'Request content is required'
      });
    }
    
    console.log(`[MultiSwarmAPI] Routing request to best swarm:`, request);
    
    const result = await multiSwarmManager.routeToBestSwarm(request, userId);
    
    if (result.success) {
      res.json({
        success: true,
        swarmId: result.swarmId,
        response: result.response,
        threadId: result.threadId,
        toolCalls: result.toolCalls,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error routing to best swarm:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Inter-swarm communication
app.post('/api/multi-swarm/communicate', async (req, res) => {
  try {
    const { fromSwarmId, toSwarmId, message, context } = req.body;
    
    if (!fromSwarmId || !toSwarmId || !message) {
      return res.status(400).json({
        success: false,
        error: 'From swarm ID, to swarm ID, and message are required'
      });
    }
    
    console.log(`[MultiSwarmAPI] Inter-swarm communication: ${fromSwarmId} -> ${toSwarmId}`);
    
    const result = await multiSwarmManager.communicateBetweenSwarms(fromSwarmId, toSwarmId, message, context);
    
    if (result.success) {
      res.json({
        success: true,
        communicationId: result.communicationId,
        response: result.result?.response || 'No response',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error in inter-swarm communication:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for processing different input formats
function processTextInput(text) {
  // Convert plain text to transcript format
  return {
    segments: [
      {
        start: 0,
        speaker: "User",
        text: text
      }
    ]
  };
}

function processFileInput(fileBuffer, filename) {
  const text = fileBuffer.toString('utf-8');
  console.log(`[FileProcessor] Processing file: ${filename} (${text.length} characters)`);
  
  // For .txt files, treat as plain text
  if (filename.toLowerCase().endsWith('.txt')) {
    return processTextInput(text);
  }
  
  // For other files, try to parse as JSON first, then fallback to text
  try {
    const jsonData = JSON.parse(text);
    if (jsonData.segments || jsonData.transcript) {
      return jsonData.segments ? jsonData : jsonData.transcript;
    }
  } catch (e) {
    console.log(`[FileProcessor] File is not JSON, treating as plain text`);
  }
  
  return processTextInput(text);
}

function generateDefaultIds() {
  return {
    meetingId: `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: 'default_user',
    agentType: 'linear'
  };
}



// New specialized endpoint: Process transcript with inter-swarm communication workflow
app.post('/api/multi-swarm/process-transcript-workflow', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    let { transcript, text, meetingId, agentType, userId, enableNotifications } = req.body;
    // New payload support: accept meeting record style fields
    const {
      id: meetingRecordId,
      user_id: altUserId,
      platform,
      native_meeting_id,
      constructed_meeting_url,
      status: meetingStatus,
      bot_container_id,
      connection_id,
      start_time,
      end_time,
      data: meetingData,
      created_at,
      updated_at,
      transcript_generated_at
    } = req.body || {};

    // Normalize and sanitize text if provided (remove BOM, trim)
    const normalizedText = typeof text === 'string' ? text.replace(/^\ufeff/, '').trim() : text;

    // Validate presence of at least one input form
    if (!req.file && !normalizedText && !transcript) {
      return res.status(400).json({
        success: false,
        error: 'No valid input found. Please provide either a file upload, text content, or transcript object.'
      });
    }

    // Generate default values (kept for metadata)
    const derivedMeetingId = meetingId || native_meeting_id || constructed_meeting_url || (typeof meetingRecordId !== 'undefined' ? String(meetingRecordId) : null);
    const finalMeetingId = derivedMeetingId || generateDefaultIds().meetingId;
    const finalUserId = userId || altUserId || generateDefaultIds().userId;
    const finalAgentType = agentType || generateDefaultIds().agentType;
    const finalEnableNotifications = enableNotifications !== false; // Default to true

    // Derive idempotency key: prefer header, else use provided meetingId
    // Note: if meetingId was not provided (we generated one), retries will not dedupe.
    const headerIdem = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');
    const idempotencyKey = headerIdem || meetingId || native_meeting_id || constructed_meeting_url || (typeof meetingRecordId !== 'undefined' ? String(meetingRecordId) : null);

    // Prepare meeting/job semantics
    const meetingDateIso = end_time || new Date().toISOString();
    const meetingDate = new Date(meetingDateIso);
    const y = meetingDate.getUTCFullYear();
    const m = String(meetingDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(meetingDate.getUTCDate()).padStart(2, '0');
    const dateLabel = `${y}-${m}-${d}`;
    const meetingIdentifier = native_meeting_id || finalMeetingId;
    const workflowLabel = `${dateLabel}_${meetingIdentifier}`;

    // Create/reuse job based on idempotency
    let job = null;
    if (idempotencyKey) {
      const existing = idempotencyMap.get(idempotencyKey);
      if (existing) {
        const existingJob = getJob(existing.id || existing);
        if (existingJob) {
          return res.status(202).json({
            success: true,
            accepted: true,
            jobId: existingJob.id,
            statusUrl: `/api/jobs/${existingJob.id}`,
            meetingId: existingJob.meta?.meetingId || finalMeetingId,
            agentType: existingJob.meta?.agentType || finalAgentType,
            receivedAt: existingJob.createdAt,
            idempotency: { reused: true }
          });
        }
      }
      job = createJob({
        endpoint: '/api/multi-swarm/process-transcript-workflow',
        meetingId: finalMeetingId,
        userId: finalUserId,
        agentType: finalAgentType,
        enableNotifications: finalEnableNotifications,
        submittedAtMs: startTime,
        idempotencyKey,
        meetingDate: meetingDateIso,
        workflowLabel,
        // Attach new payload metadata for observability
        platform,
        native_meeting_id,
        constructed_meeting_url,
        meetingStatus,
        bot_container_id,
        connection_id,
        start_time,
        end_time,
        created_at,
        updated_at,
        transcript_generated_at
      });
      idempotencyMap.set(idempotencyKey, job);
    } else {
      job = createJob({
        endpoint: '/api/multi-swarm/process-transcript-workflow',
        meetingId: finalMeetingId,
        userId: finalUserId,
        agentType: finalAgentType,
        enableNotifications: finalEnableNotifications,
        submittedAtMs: startTime,
        meetingDate: meetingDateIso,
        workflowLabel,
        // Attach new payload metadata for observability
        platform,
        native_meeting_id,
        constructed_meeting_url,
        meetingStatus,
        bot_container_id,
        connection_id,
        start_time,
        end_time,
        created_at,
        updated_at,
        transcript_generated_at
      });
    }

    res.status(202).json({
      success: true,
      accepted: true,
      jobId: job.id,
      statusUrl: `/api/jobs/${job.id}`,
      meetingId: finalMeetingId,
      agentType: finalAgentType,
      receivedAt: new Date().toISOString()
    });

    // After response, process in background or via Workflow trigger
    setImmediate(async () => {
      try {
        updateJob(job.id, { status: 'running', progress: 5 });
    
    // Handle different input formats
    let processedTranscript = null;
    let inputSource = 'unknown';
    
    if (req.file) {
      console.log(`[MultiSwarmAPI] Processing uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);
      processedTranscript = processFileInput(req.file.buffer, req.file.originalname);
      inputSource = 'file_upload';
        } else if (normalizedText) {
      console.log(`[MultiSwarmAPI] Processing text input (${normalizedText.length} characters)`);
      processedTranscript = processTextInput(normalizedText);
      inputSource = 'text_input';
        } else if (transcript) {
      console.log(`[MultiSwarmAPI] Processing transcript object`);
      processedTranscript = transcript;
      inputSource = 'transcript_object';
    }

        // Trigger Upstash Workflow (durable orchestration)
        try {
          // Light-weight idempotency via label: skip if existing run with same label
          try {
            const existing = await workflow.findRunsByLabel(workflowLabel, { count: 1 });
            if (existing?.runs?.length) {
              updateJob(job.id, { status: 'queued', progress: 5, meta: { ...job.meta, queuedVia: 'workflow', reusedLabel: workflowLabel, existingRunId: existing.runs[0].runId || existing.runs[0].id } });
              return;
            }
          } catch (listErr) {
            console.warn('[MultiSwarmAPI] Unable to list runs by label, proceeding to trigger:', listErr.message);
          }

          const triggerPayload = {
            tenantId: finalUserId || 'global',
            sessionId: finalMeetingId,
            flowType: 'default',
            payload: {
              transcript,
              text: normalizedText,
              meetingId: finalMeetingId,
              agentType: finalAgentType,
              userId: finalUserId,
              enableNotifications: finalEnableNotifications,
              inputSource,
              jobId: job.id,
              // New payload metadata passthrough
              platform,
              native_meeting_id,
              constructed_meeting_url,
              meetingStatus,
              bot_container_id,
              connection_id,
              start_time,
              end_time,
              created_at,
              updated_at,
              transcript_generated_at,
              meetingRecordId
            }
          };
          const run = await workflow.trigger(triggerPayload, { label: workflowLabel });
          updateJob(job.id, { status: 'queued', progress: 5, meta: { ...job.meta, queuedVia: 'workflow', runId: run.runId || null } });
          return; // orchestration handled by workflow
        } catch (e) {
          console.warn('[MultiSwarmAPI] Workflow trigger failed, falling back to local processing:', e.message);
        }

        // Local fallback processing
    // Step 1: Process transcript with summarizer
    const summaryResult = await meetingSummarizer.processCompleteWorkflow(processedTranscript, finalMeetingId);
    if (!summaryResult.success) {
          updateJob(job.id, { status: 'failed', progress: 100, error: {
            message: 'Failed to process transcript with summarizer',
        details: summaryResult.error,
            meetingId: finalMeetingId
          }});
          return;
        }
        updateJob(job.id, { progress: 40 });

        // Step 2: Analyze action items with Linear context
    const analysisResult = await meetingSummarizer.analyzeActionItemsWithContext(
      summaryResult.actionItems || 'No specific action items extracted',
      finalMeetingId
    );
    if (!analysisResult.success) {
          updateJob(job.id, { status: 'failed', progress: 100, error: {
            message: 'Failed to analyze action items with Linear context',
        details: analysisResult.error,
            meetingId: finalMeetingId
          }});
          return;
        }
        updateJob(job.id, { progress: 60 });

        // Step 3: Create execution prompt
        const executionPrompt = `\nEXECUTE THESE SPECIFIC LINEAR OPERATIONS:\n\nMEETING ID: ${finalMeetingId}\n\nANALYSIS RESULT:\n${analysisResult.analysis}\n\nEXECUTION INSTRUCTIONS:\nFollow the analysis above and execute the specified Linear operations precisely. \nDo NOT make decisions - only execute what is specified in the analysis.\nCreate, update, or comment on issues exactly as described in the analysis.\n\nRemember to:\n1. Always assign assignees to new issues\n2. Use proper priority levels (0-4)\n3. Create subtasks with parent_id when specified\n4. Include meeting context in descriptions\n5. Notify the communication swarm when complete\n`;

        // Step 4: Execute via swarm
    const swarmResult = await multiSwarmManager.processWithSwarm('project-management', executionPrompt, finalUserId);
        if (!swarmResult.success) {
          updateJob(job.id, { status: 'failed', progress: 100, error: {
            message: 'Swarm execution failed',
            details: swarmResult.error,
            meetingId: finalMeetingId
          }, meta: { inputSource } });
          return;
        }

        // Complete
        updateJob(job.id, {
          status: 'completed',
          progress: 100,
          result: {
        meetingId: finalMeetingId,
        agentType: finalAgentType,
        summary: {
          formattedTranscript: summaryResult.formattedTranscript,
          summary: summaryResult.summary,
          actionItems: summaryResult.actionItems,
          actionItemsError: summaryResult.actionItemsError
        },
        swarmResult: swarmResult,
            notification: finalEnableNotifications ? { enabled: true } : { enabled: false },
        inputSource: inputSource,
            durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error(`[MultiSwarmAPI][Background] Job ${job.id} failed:`, error);
        updateJob(job.id, { status: 'failed', progress: 100, error: { message: error.message, stack: error.stack } });
      }
    });

  } catch (error) {
    console.error(`[MultiSwarmAPI][Response] /api/multi-swarm/process-transcript-workflow | Exception (pre-ack) | meetingId: ${req.body.meetingId || null} | agentType: ${req.body.agentType || null} | Duration: ${Date.now() - startTime}ms | Error: ${error.message}`);
      res.status(500).json({
        success: false,
      error: error.message,
      meetingId: req.body.meetingId || null,
      timestamp: new Date().toISOString()
    });
  }
});

// Jobs status endpoint
app.get('/api/jobs/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        result: job.result,
        error: job.error,
        meta: job.meta
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Removed old QStash worker endpoint.

// Get communication history
app.get('/api/multi-swarm/communications', (req, res) => {
  try {
    const { swarmId } = req.query;
    console.log(`[MultiSwarmAPI] Getting communication history for swarm: ${swarmId || 'all'}`);
    
    const history = multiSwarmManager.getCommunicationHistory(swarmId);
    
    res.json({
      success: true,
      swarmId: swarmId || 'all',
      communications: history,
      count: history.length
    });
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error getting communication history:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Destroy a swarm
app.delete('/api/multi-swarm/swarms/:swarmId', (req, res) => {
  try {
    const { swarmId } = req.params;
    console.log(`[MultiSwarmAPI] Destroying swarm: ${swarmId}`);
    
    const result = multiSwarmManager.destroySwarm(swarmId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Swarm ${swarmId} destroyed successfully`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error(`[MultiSwarmAPI] Error destroying swarm:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check for multi-swarm system
app.get('/api/multi-swarm/health', (req, res) => {
  try {
    const healthInfo = multiSwarmManager.getHealth();
    res.json(healthInfo);
  } catch (error) {
    console.error('[MultiSwarmAPI] Error checking multi-swarm health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Log Management Endpoints
app.get('/api/logs', (req, res) => {
  try {
    const logFiles = logger.getLogFiles();
    res.json({
      success: true,
      logFiles,
      currentLogFile: logger.getCurrentLogFile(),
      logsDirectory: logger.getLogsDirectory()
    });
  } catch (error) {
    console.error('[LogsAPI] Error getting log files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const logContent = logger.readLogFile(filename);
    
    if (logContent === null) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found'
      });
    }
    
    res.json({
      success: true,
      filename,
      content: logContent,
      size: logContent.length
    });
  } catch (error) {
    console.error('[LogsAPI] Error reading log file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/logs/clean', (req, res) => {
  try {
    logger.cleanOldLogs();
    res.json({
      success: true,
      message: 'Old logs cleaned successfully'
    });
  } catch (error) {
    console.error('[LogsAPI] Error cleaning logs:', error);
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
  console.log(`📝 Logs available at: ${logger.getLogsDirectory()}`);
  logger.logSystemEvent(`Server started successfully on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down A2A Backend Server...');
  logger.logSystemEvent('Server shutdown initiated');
  
  // Destroy all agents
  const agents = agentManager.listAgents();
  for (const agent of agents) {
    try {
      await agentManager.destroyAgent(agent.id);
      logger.logAgentOperation('destroyed', agent.id);
    } catch (error) {
      console.error(`Error destroying agent ${agent.id}:`, error);
      logger.logSystemEvent(`Error destroying agent ${agent.id}`, { error: error.message });
    }
  }
  
  console.log('✅ All agents destroyed');
  logger.logSystemEvent('All agents destroyed');
  console.log('👋 A2A Backend Server shut down gracefully');
  logger.logSystemEvent('Server shutdown completed');
  process.exit(0);
});

// Patch: Add a discoverable property to agents and toggle endpoint

// Patch 1: Ensure all agents have discoverable property (default true)
const ensureDiscoverable = (agent) => {
  if (typeof agent.discoverable !== 'boolean') agent.discoverable = true;
  return agent;
};