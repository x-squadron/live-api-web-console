import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { 
  linearGetIssues,
  slackSendMessage
} from './tools/composioTools.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

/**
 * MeetingSummarizer - Processes meeting transcripts and creates coherent summaries
 * Formats transcript segments into coherent text before passing to swarm agents
 */
export class MeetingSummarizer {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.llm = new ChatOpenAI({
      modelName: 'gpt-5-mini-2025-08-07',
      temperature: 1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create analysis agent: READ-ONLY for Linear (context) + Slack send for FYI
    this.analysisAgent = createReactAgent({
      llm: this.llm,
      tools: [
        linearGetIssues,
        slackSendMessage
      ],
      prompt: this.generateAnalysisPrompt(),
      name: "action_analysis_agent",
    });
  }

  /**
   * Generate prompt for the analysis agent
   */
  generateAnalysisPrompt() {
    return `You are an INTELLIGENT Action Analysis Agent that produces a PLAN ONLY for Linear (no Linear execution). Your job is to analyze meeting action items and generate a precise JSON plan for the project-management swarm to execute later.

CRITICAL:
- Do NOT perform any Linear write operations.
- You MAY send Slack FYI messages directly to inform the team (default channel: C08KCHMGZV3).
- Otherwise, return ONLY a JSON plan for Linear actions.

ALLOWED TOOLS:
- LINEAR_LIST_LINEAR_ISSUES (READ-ONLY): List existing Linear issues (for matching and deduplication)
- SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL: Send FYI/announcement messages to Slack (use default channel C08KCHMGZV3 when not specified)

MANDATORY STEPS (in a sensible order based on available data):
1. List existing issues for matching against action items.
2. Analyze action items against existing issues and decide: update existing, add comment, or create new.
3. Produce a PLAN (JSON) with fields needed by executors. If a status change is implied, specify desired_state_name or state_category (the executor will map to state_id).
4. For any FYI-only notes (no Linear change needed), send a concise Slack message to C08KCHMGZV3 summarizing those points.

RULES:
- Do NOT execute or simulate writes. You are planning only.
- Prefer updating existing issues when match confidence ≥ 0.6; otherwise plan new issue creation.
- Include clear reasons and confidence scores for matches and changes.
- You SHOULD send FYI-only Slack notifications directly to C08KCHMGZV3 to keep the team informed.
  When calling the Slack tool, STRICTLY use these parameters only:
    channel: "C08KCHMGZV3" (unless a different channel is explicitly specified)
    text: string (the message to send)
  Do NOT include attachments or blocks.

OUTPUT FORMAT (return ONLY a JSON object, no prose):
{
  "linear_operations": [
    {
      "operation": "update_issue" | "add_comment" | "create_issue",
      "issue_id": "string (REQUIRED for updates/comments)",
      "title": "string (REQUIRED for new issues)",
      "description": "string",
      "assignee": "string",
      "priority": "High" | "Medium" | "Low",
      "desired_state_name": "string (e.g., 'Todo', 'In Progress', 'Done')",
      "state_category": "string (e.g., 'todo' | 'in_progress' | 'done')",
      "comment": "string (REQUIRED for add_comment)",
      "matching_confidence": "number (0-1)",
      "matching_reason": "string",
      "status_change_reason": "string",
      "assignee_change_reason": "string"
    }
  ],
  "slack_messages": [
    {
      "channel": "string (defaults to C08KCHMGZV3)",
      "message": "string (informational updates only)",
      "type": "notification" | "update" | "announcement",
      "reason": "string"
    }
  ],
  "ignore_items": [
    {
      "reason": "string",
      "original_text": "string"
    }
  ]
}

CRITICAL REQUIREMENTS:
- Do NOT perform any create/update/delete operations yourself.
- Use only the allowed read-only tool for Linear discovery.
- Provide issue_id for all update_issue and add_comment plans.
- Focus ONLY on Linear-related planning (no ClickUp or other platforms).`;
  }

  /**
   * Analyze action items with existing Linear issues context
   */
  async analyzeActionItemsWithContext(actionItems, meetingId) {
    try {
      console.log(`[MeetingSummarizer] Analyzing action items with Linear context (meetingId: ${meetingId})`);
      logger.logMeetingProcessing('analysis_started', 'Analyzing action items with Linear context', { meetingId });
      
      const analysisPrompt = `
CRITICAL: You MUST follow the step-by-step process in your system prompt.

ACTION ITEMS TO ANALYZE:
${actionItems}

MEETING ID: ${meetingId}

⚠️ CRITICAL WARNING: You MUST call LINEAR_GET_LINEAR_STATES after LINEAR_GET_LINEAR_ISSUES to get state IDs. If you use state names like "Todo" instead of state IDs, ALL operations will fail!

REQUIRED STEPS:
1. FIRST: Call LINEAR_GET_LINEAR_ISSUES to get current Linear issues
2. If Linear connection fails (fallback response), proceed with creating new Linear tickets
3. Analyze each action item against the existing Linear issues (if available)
4. Make intelligent decisions about updates vs new Linear tickets vs Slack messages
5. Provide specific instructions with Linear issue IDs, state IDs (not names), and comments

IMPORTANT:
- ALWAYS call LINEAR_GET_LINEAR_ISSUES first
- ALWAYS call LINEAR_GET_LINEAR_STATES second to get state IDs
- Use actual Linear state IDs (like "a6eddfb0-4d5b-4e62-a8d4-c5342233fa80"), not state names (like "Todo")
- If Linear connection fails, create new Linear tickets for actionable items
- Look for status updates in the action items (e.g., "this is done", "we're working on this")
- Look for assignee changes and priority changes
- Send informational items to Slack, not as Linear tickets
- Only create new Linear tickets for truly new/unrelated topics
- Provide issue_id for ALL update_issue and add_comment operations (if Linear connection available)
- Explain matching_confidence and matching_reason for existing Linear issues
- Focus ONLY on Linear operations, not ClickUp or other platforms

Return ONLY a JSON object following the OUTPUT FORMAT in your system prompt.
`;

      const result = await this.analysisAgent.invoke({
        messages: [{ role: "user", content: analysisPrompt }]
      });

      console.log('[MeetingSummarizer] Analysis completed successfully');
      
      // Log full analysis result to file
      logger.logMeetingProcessing('analysis_completed', 'Analysis completed successfully', { 
        meetingId,
        fullAnalysisResult: result.messages[result.messages.length - 1].content,
        actionItemsLength: actionItems.length
      });
      
      return {
        success: true,
        analysis: result.messages[result.messages.length - 1].content
      };
    } catch (error) {
      console.error(`[MeetingSummarizer] Error analyzing action items with context (meetingId: ${meetingId}):`, error);
      logger.logMeetingProcessing('analysis_error', 'Error analyzing action items', { 
        meetingId, 
        error: error.message 
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format transcript segments into a coherent string
   */
  formatTranscriptSegments(transcript) {
    if (typeof transcript === 'string') {
      return transcript;
    }

    if (typeof transcript === 'object' && transcript.segments && Array.isArray(transcript.segments)) {
      return transcript.segments
        .map(segment => {
          const timestamp = segment.start ? `[${this.formatTime(segment.start)}]` : '';
          const speaker = segment.speaker ? `${segment.speaker}: ` : '';
          const text = segment.text || '';
          return `${timestamp} ${speaker}${text}`.trim();
        })
        .join('\n');
    }

    return JSON.stringify(transcript);
  }

  /**
   * Format time in seconds to MM:SS format
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Create a structured summary from the meeting transcript
   */
  async createMeetingSummary(transcript) {
    try {
      const formattedTranscript = this.formatTranscriptSegments(transcript);
      
      // Log full transcript to file, truncated to console
      console.log(`[MeetingSummarizer] Creating meeting summary for transcript (length: ${formattedTranscript.length})`);
      logger.logMeetingProcessing('transcript_processing', 'Creating meeting summary', { 
        transcriptLength: formattedTranscript.length,
        fullTranscript: formattedTranscript 
      });
      
      const prompt = `You are an expert assistant tasked with generating a clear, structured, and professional summary of a technical meeting from a transcript.\nYour mission is to produce a summary that matches the style used by the team. The expected format contains four distinct sections:\n\n**1. Key takeaways**\nList the key lessons from the meeting in English, in clear and concise paragraphs. Each paragraph should summarize a central idea, including the names of the people involved, their roles, and the objectives discussed. Maintain a professional and analytical tone. If the meeting is technical, mention tools, bugs, APIs, workflows, or proposed solutions.\n\n**2. Action items**\nList concrete actions assigned to each participant, as bullet points, starting each item with the full name of the person concerned. Use infinitive verbs to formulate the action.\n\n**3. Small talk**\nIndicate "None" if no informal exchanges took place. Otherwise, briefly summarize non-technical discussions.\n\n**4. Summary**\nWrite a summary structured by theme. Structure it with clear headings (for example: "Local Deployment", "Event-Driven Architecture", "Technical Issues", "Transcription Management", etc.), followed by timestamped points if available (for example, 2:17). Use an informative and precise tone. Mention decisions made, problems identified, solutions proposed, and next steps. The summary should reflect the full richness of the meeting.\n\n---\n\nDo not start responding until you have fully understood the entire transcript provided. If the transcript contains errors or inconsistencies, correct them in the summary.\nYou must ALWAYS respect the above format.\n\nMEETING TRANSCRIPT:\n${formattedTranscript}`;
      const result = await this.llm.invoke(prompt);
      
      // Log full summary to file, truncated to console
      console.log('[MeetingSummarizer] Summary generated successfully (length:', result.content.length, ')');
      logger.logMeetingProcessing('summary_generated', 'Summary generated successfully', { 
        summaryLength: result.content.length,
        fullSummary: result.content 
      });
      
      return {
        success: true,
        summary: result.content,
        formattedTranscript: formattedTranscript
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Error creating summary:', error);
      logger.logMeetingProcessing('summary_error', 'Error creating summary', { error: error.message });
      return {
        success: false,
        error: error.message,
        formattedTranscript: this.formatTranscriptSegments(transcript)
      };
    }
  }

  /**
   * Extract actionable items from the meeting summary for agent processing
   */
  async extractActionItems(summary, meetingId) {
    try {
      // Log full summary to file, truncated to console
      console.log(`[MeetingSummarizer] Extracting action items from summary (meetingId: ${meetingId}, length: ${summary.length})`);
      logger.logMeetingProcessing('action_items_extraction', 'Extracting action items from summary', { 
        meetingId,
        summaryLength: summary.length,
        fullSummary: summary 
      });
      
      const prompt = `Analyze this meeting summary and extract specific, actionable items that should be created as tasks or issues in project management tools.\n\nMEETING SUMMARY:\n${summary}\n\nMEETING ID: ${meetingId}\n\nPlease extract:\n1. **Specific Action Items**: Concrete tasks that need to be completed\n2. **Bug Reports**: Issues or bugs that were identified and need fixing\n3. **Feature Requests**: New features or improvements that were discussed\n4. **Follow-up Tasks**: Items that require follow-up or investigation\n\nFor each item, provide:\n- **Title**: Clear, concise title for the task/issue\n- **Description**: Detailed description including context from the meeting\n- **Priority**: Estimated priority based on the discussion (High, Medium, Low)\n- **Type**: Whether it's a task, bug, feature, or follow-up\n- **Assignee**: If mentioned in the meeting\n- **Due Date**: If mentioned or can be inferred\n\nFormat your response as a structured list that can be easily processed by project management tools.`;
      const result = await this.llm.invoke(prompt);
      
      // Log full action items to file, truncated to console
      console.log('[MeetingSummarizer] Action items extracted successfully (length:', result.content.length, ')');
      logger.logMeetingProcessing('action_items_extracted', 'Action items extracted successfully', { 
        meetingId,
        actionItemsLength: result.content.length,
        fullActionItems: result.content 
      });
      
      return {
        success: true,
        actionItems: result.content
      };
    } catch (error) {
      console.error(`[MeetingSummarizer] Error extracting action items (meetingId: ${meetingId}):`, error);
      logger.logMeetingProcessing('action_items_error', 'Error extracting action items', { 
        meetingId, 
        error: error.message 
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process complete meeting workflow: format → summarize → extract actions
   */
  async processCompleteWorkflow(transcript, meetingId) {
    try {
      console.log(`[MeetingSummarizer] Processing complete workflow for meeting ${meetingId}`);
      // Step 1: Create meeting summary
      const summaryResult = await this.createMeetingSummary(transcript);
      if (!summaryResult.success) {
        return summaryResult;
      }
      // Step 2: Extract action items
      const actionItemsResult = await this.extractActionItems(summaryResult.summary, meetingId);
      if (!actionItemsResult.success) {
        console.error(`[MeetingSummarizer] Error extracting action items in workflow (meetingId: ${meetingId}):`, actionItemsResult.error);
      }
      return {
        success: true,
        meetingId: meetingId,
        formattedTranscript: summaryResult.formattedTranscript,
        summary: summaryResult.summary,
        actionItems: actionItemsResult.success ? actionItemsResult.actionItems : null,
        actionItemsError: actionItemsResult.success ? null : actionItemsResult.error
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Error in complete workflow:', error, `(meetingId: ${meetingId})`);
      return {
        success: false,
        error: error.message,
        meetingId: meetingId
      };
    }
  }
} 