import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIToolSet } from 'composio-core';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

dotenv.config();

/**
 * Linear Meeting Agent using the same working approach as dynamic agents
 */
class LinearMeetingAgent {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    
    if (!process.env.COMPOSIO_API_KEY) {
      throw new Error('COMPOSIO_API_KEY is required');
    }

    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Use OpenAIToolSet like the working dynamic agents
    this.composioToolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
    });

    this.reactAgent = null;
    this.userId = process.env.COMPOSIO_ENTITY_ID || 'default_user';
  }

  async createComposioTools(actions) {
    try {
      console.log(`[LinearMeetingAgent] Creating Composio tools for actions: ${actions.join(', ')}`);
      
      // Get Composio tools using OpenAIToolSet
      const composioTools = await this.composioToolset.getTools({
        actions: actions,
      });
      
      // Convert to LangChain tools using the same approach as dynamic agents
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
              
              // Execute the tool using Composio with the same approach as dynamic agents
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
                this.userId
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
      
      console.log(`[LinearMeetingAgent] Created ${langchainTools.length} LangChain tools`);
      return langchainTools;
      
    } catch (error) {
      console.error('[LinearMeetingAgent] Error creating Composio tools:', error);
      return [];
    }
  }

  async initialize() {
    console.log(`[LinearMeetingAgent] Initializing with userId: ${this.userId}`);
    
    // Get Linear tools using the same approach as dynamic agents
    const actions = [
      'LINEAR_LIST_LINEAR_ISSUES',
      'LINEAR_LIST_LINEAR_PROJECTS', 
      'LINEAR_CREATE_LINEAR_ISSUE',
      'LINEAR_UPDATE_ISSUE',
      'LINEAR_DELETE_LINEAR_ISSUE',
      'LINEAR_LIST_LINEAR_TEAMS',
      'LINEAR_LIST_LINEAR_STATES'
    ];

    const tools = await this.createComposioTools(actions);
    console.log(`[LinearMeetingAgent] Got ${tools.length} tools`);

    // Create system prompt
    const systemPrompt = `You are a Linear Meeting Agent that manages Linear issues autonomously based on meeting transcripts.

AVAILABLE TOOLS:
- LINEAR_LIST_LINEAR_PROJECTS: List projects with their teams and IDs (start here to get project_id)
- LINEAR_LIST_LINEAR_TEAMS: Get team information using project_id (needed for creating issues)
- LINEAR_LIST_LINEAR_ISSUES: List existing Linear issues in the workspace (filter by project if needed)
- LINEAR_LIST_LINEAR_STATES: Get all possible states (To Do, In Progress, Done, etc.) with their UUIDs
- LINEAR_CREATE_LINEAR_ISSUE: Create new Linear issues (requires: title, description, team_id, and optionally state_id)
- LINEAR_UPDATE_ISSUE: Update existing issues (status using state_id, priority, etc.)
- LINEAR_DELETE_LINEAR_ISSUE: Delete issues by ID when they are no longer needed

ENHANCED WORKFLOW FOR MEETING TRANSCRIPT PROCESSING:
1. **DISCOVERY PHASE:**
   - First use LINEAR_LIST_LINEAR_PROJECTS to get the project ID for "Faktions" project
   - Use the project_id to get team_id via LINEAR_LIST_LINEAR_TEAMS
   - List existing issues for the project using LINEAR_LIST_LINEAR_ISSUES
   - Get available states and their UUIDs using LINEAR_LIST_LINEAR_STATES

2. **ANALYSIS PHASE:**
   - Analyze the meeting transcript to identify:
     * New action items/tasks that need Linear issues
     * Existing issues mentioned that need status updates
     * Completed items that should be moved to "Done" state
     * Issues that are no longer relevant and should be deleted

3. **EXECUTION PHASE:**
   - Create new issues for identified action items (use appropriate state_id from LINEAR_LIST_LINEAR_STATES)
   - Update existing issues' states based on progress mentioned in transcript
   - Delete issues that are mentioned as cancelled or no longer needed
   - Provide a comprehensive summary of all actions taken

IMPORTANT GUIDELINES:
- Always start by getting project info, team info, current issues, and available states
- When creating issues, use team_id from step 1 and appropriate state_id from LINEAR_LIST_LINEAR_STATES
- When updating issues, use state_id from LINEAR_LIST_LINEAR_STATES to set correct status
- Be thorough in your analysis - extract all actionable items from transcripts
- Provide detailed summaries of what was created, updated, or deleted
- Execute all necessary operations - don't just describe what you would do
- We are working on the "Faktions" project

Be autonomous, thorough, and systematic in managing Linear issues based on meeting content.`;

    // Create React agent with memory using the same approach as dynamic agents
    const memory = new MemorySaver();
    this.reactAgent = createReactAgent({
      llm: this.llm,
      tools: tools,
      checkpointSaver: memory,
      messageModifier: systemPrompt
    });

    console.log('[LinearMeetingAgent] ✅ Ready with React agent');
  }

  async invoke(input) {
    if (!this.reactAgent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      console.log(`[LinearMeetingAgent] Processing: ${input}`);
      
      // Use the same invocation approach as dynamic agents
      const config = {
        configurable: {
          thread_id: `linear-agent-${Date.now()}`
        }
      };

      const result = await this.reactAgent.invoke(
        { messages: [{ role: 'user', content: input }] },
        config
      );

      // Extract the response from the agent result
      const messages = result.messages || [];
      const lastMessage = messages[messages.length - 1];
      const output = lastMessage?.content || 'No response generated';

      console.log(`[LinearMeetingAgent] Response: ${output}`);
      return { output };

    } catch (error) {
      console.error(`[LinearMeetingAgent] Error:`, error);
      return { output: `Error: ${error.message}` };
    }
  }

  // Method to get project setup information for Linear operations
  async getProjectSetup(projectName = "Faktions") {
    const prompt = `Get the complete setup information for the "${projectName}" project:

1. Use LINEAR_LIST_LINEAR_PROJECTS to find the "${projectName}" project and get its project_id
2. Use LINEAR_LIST_LINEAR_TEAMS with the project_id to get team information and team_id
3. Use LINEAR_LIST_LINEAR_STATES to get all available states with their UUIDs
4. Use LINEAR_LIST_LINEAR_ISSUES to get current issues for this project

Provide a structured summary with:
- Project ID and details
- Team ID and information
- Available states (names and UUIDs)
- Current issues count and brief overview

This information will be used for subsequent issue management operations.`;

    return await this.invoke(prompt);
  }

  // Enhanced method for processing meeting transcripts with the new workflow
  async processMeeting(transcript) {
    const prompt = `Process this meeting transcript using the enhanced workflow to manage Linear issues comprehensively:

MEETING TRANSCRIPT:
${transcript}

INSTRUCTIONS:
Follow the ENHANCED WORKFLOW FOR MEETING TRANSCRIPT PROCESSING exactly:

1. **DISCOVERY PHASE - Execute these steps first:**
   - Get the "Faktions" project ID using LINEAR_LIST_LINEAR_PROJECTS
   - Get team information using the project_id via LINEAR_LIST_LINEAR_TEAMS
   - List all current issues for the project using LINEAR_LIST_LINEAR_ISSUES
   - Get all available states and their UUIDs using LINEAR_LIST_LINEAR_STATES

2. **ANALYSIS PHASE - Carefully analyze the transcript for:**
   - New action items or tasks mentioned that should become Linear issues
   - Existing issues referenced that need status updates (in progress, completed, blocked, etc.)
   - Items mentioned as completed that should be moved to "Done" state
   - Issues that are cancelled, postponed, or no longer relevant

3. **EXECUTION PHASE - Take actions based on your analysis:**
   - Create new Linear issues for identified action items (use team_id and appropriate state_id)
   - Update existing issues' states using state_id from the available states
   - Delete issues that are explicitly mentioned as cancelled or no longer needed
   - Provide a detailed summary of all actions taken

EXPECTED OUTPUT:
Provide a comprehensive report including:
- Current project and team information found
- List of existing issues before processing
- Analysis of what was identified in the transcript
- Detailed list of all actions taken (created, updated, deleted issues)
- Final summary of the Linear workspace state after processing

Execute all operations completely - don't just plan or describe what you would do.`;

    return await this.invoke(prompt);
  }
}

export function createLinearAgent() {
  return new LinearMeetingAgent();
} 