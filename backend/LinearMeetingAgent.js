import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIToolSet } from 'composio-core';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

dotenv.config();

/**
 * Meeting Summarizer - Step 1: Simple LLM for transcript summarization
 * This handles only the meeting summary generation without any agent tools
 */
class MeetingSummarizer {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.llm = new ChatOpenAI({
      modelName: 'gpt-5-mini-2025-08-07',
      temperature: 1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  }

  async summarize(transcript) {
    try {
      console.log('[MeetingSummarizer] Creating meeting summary...');
      
      const prompt = `You are an expert assistant tasked with generating a clear, structured, and professional summary of a technical meeting from a transcript.
Your mission is to produce a summary that matches the style used by the team. The expected format contains four distinct sections:

**1. Key takeaways**
List the key lessons from the meeting in English, in clear and concise paragraphs. Each paragraph should summarize a central idea, including the names of the people involved, their roles, and the objectives discussed. Maintain a professional and analytical tone. If the meeting is technical, mention tools, bugs, APIs, workflows, or proposed solutions.

**2. Action items**
List concrete actions assigned to each participant, as bullet points, starting each item with the full name of the person concerned. Use infinitive verbs to formulate the action.

**3. Small talk**
Indicate "None" if no informal exchanges took place. Otherwise, briefly summarize non-technical discussions.

**4. Summary**
Write a summary structured by theme. Structure it with clear headings (for example: "Local Deployment", "Event-Driven Architecture", "Technical Issues", "Transcription Management", etc.), followed by timestamped points if available (for example, 2:17). Use an informative and precise tone. Mention decisions made, problems identified, solutions proposed, and next steps. The summary should reflect the full richness of the meeting.

---

Do not start responding until you have fully understood the entire transcript provided. If the transcript contains errors or inconsistencies, correct them in the summary.
You must ALWAYS respect the above format.

MEETING TRANSCRIPT:
${transcript}`;

      const result = await this.llm.invoke(prompt);
      console.log('[MeetingSummarizer] Summary generated successfully');
      
      return {
        success: true,
        summary: result.content
      };
      
    } catch (error) {
      console.error('[MeetingSummarizer] Error creating summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

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
      modelName: 'gpt-5-mini-2025-08-07',
      temperature: 1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Use OpenAIToolSet like the working dynamic agents
    this.composioToolset = new OpenAIToolSet({
      apiKey: process.env.COMPOSIO_API_KEY,
    });

    this.reactAgent = null;
    this.userId = process.env.COMPOSIO_ENTITY_ID || 'default_user';
    
    // Add loop prevention
    this.toolCallCount = 0;
    this.maxToolCalls = 20;
    this.toolCallHistory = [];
  }

  // Helper method to format tool responses clearly
  formatToolResponse(toolName, result, success = true) {
    try {
      const data = typeof result === 'string' ? JSON.parse(result) : result;
      
      if (success) {
        return `✅ ${toolName} executed successfully.\nData: ${JSON.stringify(data, null, 2)}`;
      } else {
        return `❌ ${toolName} failed.\nError: ${JSON.stringify(data, null, 2)}`;
      }
    } catch (error) {
      return `✅ ${toolName} executed.\nResult: ${result}`;
    }
  }

  // Helper method to check for repetitive tool calls
  isRepetitiveCall(toolName, args) {
    const callSignature = `${toolName}:${JSON.stringify(args)}`;
    const recentCalls = this.toolCallHistory.slice(-5); // Check last 5 calls
    const repetitions = recentCalls.filter(call => call === callSignature).length;
    
    return repetitions >= 3; // Prevent more than 3 identical calls
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
              // Check for loop prevention
              this.toolCallCount++;
              
              if (this.toolCallCount > this.maxToolCalls) {
                return `❌ Maximum tool calls (${this.maxToolCalls}) reached. Stopping to prevent infinite loops.`;
              }
              
              // Check for repetitive calls
              if (this.isRepetitiveCall(tool.function.name, args)) {
                return `❌ Repetitive call detected for ${tool.function.name}. Skipping to prevent loops.`;
              }
              
              // Track this call
              const callSignature = `${tool.function.name}:${JSON.stringify(args)}`;
              this.toolCallHistory.push(callSignature);
              
              console.log(`[Tool Execution ${this.toolCallCount}/${this.maxToolCalls}] ${tool.function.name}:`, args);
              
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
              
              // Format the response to be clearer for the agent
              return this.formatToolResponse(tool.function.name, result, true);
              
            } catch (error) {
              console.error(`[Tool Error] ${tool.function.name}:`, error);
              return this.formatToolResponse(tool.function.name, `Error: ${error.message}`, false);
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
      'LINEAR_LIST_LINEAR_STATES',
      'LINEAR_CREATE_LINEAR_COMMENT'
    ];

    const tools = await this.createComposioTools(actions);
    console.log(`[LinearMeetingAgent] Got ${tools.length} tools`);

    // Create system prompt
    const currentDateTime = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    const systemPrompt = `You are a Linear Meeting Agent that manages Linear issues autonomously based on meeting summaries.

CURRENT DATE AND TIME: ${currentDateTime}

CRITICAL INSTRUCTIONS:
- You will receive a meeting summary (already processed) and should focus ONLY on Linear issue management
- Do NOT create meeting summaries - that has already been done in a previous step
- Execute tasks efficiently and STOP when you have completed all required actions
- Do NOT repeat the same tool calls multiple times - if a tool succeeds, move on to the next task

AVAILABLE TOOLS:
- LINEAR_LIST_LINEAR_PROJECTS: List projects with their teams and IDs (start here to get project_id)
- LINEAR_LIST_LINEAR_TEAMS: Get team information using project_id (needed for creating issues)
- LINEAR_LIST_LINEAR_ISSUES: List existing Linear issues in the workspace (filter by project if needed)
- LINEAR_LIST_LINEAR_STATES: Get all possible states (To Do, In Progress, Done, etc.) with their UUIDs
- LINEAR_CREATE_LINEAR_ISSUE: Create new Linear issues (requires: title, description, team_id, and optionally state_id, parent_id for subtasks)
- LINEAR_UPDATE_ISSUE: Update existing issues (status using state_id, priority, parent_id for converting to subtask, etc.)
- LINEAR_DELETE_LINEAR_ISSUE: Delete issues by ID when they are no longer needed
- LINEAR_CREATE_LINEAR_COMMENT: Add comments to existing issues by issue_id (use for progress updates, notes, clarifications)

WORKFLOW:
1. **DISCOVERY** (do this ONCE only):
   - Get project info using LINEAR_LIST_LINEAR_PROJECTS for "Agent Test" project
   - Get team info using LINEAR_LIST_LINEAR_TEAMS
   - List existing issues using LINEAR_LIST_LINEAR_ISSUES
   - Get available states using LINEAR_LIST_LINEAR_STATES

2. **EXECUTION** (based on meeting summary):
   - Create new issues for action items mentioned in summary
   - Update existing issues if mentioned in summary
   - Add comments to issues if needed
   - Delete issues if mentioned as cancelled in summary

3. **COMPLETION**:
   - Provide a clear summary of all actions taken
   - STOP executing tools once you have completed all required actions

IMPORTANT RULES:
- Work on the "Agent Test" project
- When a tool succeeds (shows ✅), do NOT call it again with the same parameters
- If you get the information you need, proceed to the next step
- If a tool fails, try once more, then move on
- Be efficient - don't over-execute tools
- STOP when you have completed all required actions`;

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

  // Reset loop prevention counters for each new invocation
  resetLoopPrevention() {
    this.toolCallCount = 0;
    this.toolCallHistory = [];
    console.log('[LinearMeetingAgent] Loop prevention counters reset');
  }

  async invoke(input) {
    if (!this.reactAgent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      console.log(`[LinearMeetingAgent] Processing: ${input}`);
      
      // Reset loop prevention for each new invocation
      this.resetLoopPrevention();
      
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
      console.log(`[LinearMeetingAgent] Total tool calls used: ${this.toolCallCount}/${this.maxToolCalls}`);
      
      return { output };

    } catch (error) {
      console.error(`[LinearMeetingAgent] Error:`, error);
      return { output: `Error: ${error.message}` };
    }
  }

  // Method to get project setup information for Linear operations
  /* async getProjectSetup(projectName = "Faktions") {
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
  } */
}

export function createLinearAgent() {
  return new LinearMeetingAgent();
}

export function createMeetingSummarizer() {
  return new MeetingSummarizer();
}

/**
 * Main function to run the two-step Linear Meeting process
 * Step 1: Create summary using MeetingSummarizer
 * Step 2: Process summary with LinearMeetingAgent for issue management
 * @param {Object} params - The parameters object
 * @param {string} params.meetingId - The unique identifier for the meeting
 * @param {string} params.transcript - The meeting transcript to process
 * @returns {Promise<Object>} Result object with success status and agent output
 */
export async function runLinearMeetingAgent({ meetingId, transcript }) {
  try {
    console.log(`[runLinearMeetingAgent] Starting two-step processing for meeting ${meetingId}`);
    
    // Step 1: Create meeting summary using MeetingSummarizer
    console.log(`[runLinearMeetingAgent] Step 1: Creating meeting summary...`);
    const summarizer = new MeetingSummarizer();
    const summaryResult = await summarizer.summarize(transcript);
    
    if (!summaryResult.success) {
      throw new Error(`Summary creation failed: ${summaryResult.error}`);
    }
    
    console.log(`[runLinearMeetingAgent] Step 1 completed: Summary created successfully`);
    
    // Step 2: Process summary with Linear agent for issue management
    console.log(`[runLinearMeetingAgent] Step 2: Processing summary with Linear agent...`);
    const agent = new LinearMeetingAgent();
    await agent.initialize();
    
    // Create the prompt for the agent with the summary
    const prompt = `Process this meeting summary and manage Linear issues accordingly:

MEETING ID: ${meetingId}

MEETING SUMMARY:
${summaryResult.summary}

INSTRUCTIONS:
Follow the enhanced workflow to:
1. Get current project and team information
2. Analyze the summary for actionable items
3. Create, update, or delete Linear issues as needed
4. Provide a comprehensive summary of all actions taken

Be thorough and execute all necessary operations based on the meeting summary above.`;

    // Process the summary with the agent
    const result = await agent.invoke(prompt);
    
    console.log(`[runLinearMeetingAgent] Step 2 completed: Linear issues processed successfully`);
    console.log(`[runLinearMeetingAgent] Successfully processed meeting ${meetingId}`);
    
    return {
      success: true,
      meetingId,
      summary: summaryResult.summary,
      linearOutput: result.output,
      output: `MEETING SUMMARY:\n${summaryResult.summary}\n\nLINEAR ISSUE MANAGEMENT:\n${result.output}`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[runLinearMeetingAgent] Error processing meeting ${meetingId}:`, error);
    
    return {
      success: false,
      meetingId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
} 