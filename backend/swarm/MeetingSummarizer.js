import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { linearGetIssues } from './tools/composioTools.js';
import dotenv from 'dotenv';

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
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    // Create analysis agent with LINEAR_LIST_LINEAR_ISSUES tool
    this.analysisAgent = createReactAgent({
      llm: this.llm,
      tools: [linearGetIssues],
      prompt: this.generateAnalysisPrompt(),
      name: "action_analysis_agent",
    });
  }

  /**
   * Generate prompt for the analysis agent
   */
  generateAnalysisPrompt() {
    return `You are an Action Analysis Agent that analyzes meeting action items and provides complete execution instructions.

Your task:
1. Use LINEAR_LIST_LINEAR_ISSUES to check existing Linear issues
2. Analyze the action items against existing issues
3. Provide specific execution instructions for the Linear execution agent

Available Tools:
- LINEAR_LIST_LINEAR_ISSUES: List existing Linear issues in the workspace

SMART ISSUE MANAGEMENT STRATEGY:
- DO NOT always create new issues for everything
- FIRST check if an existing issue can be updated or commented on
- Use SUBTASKS for related work that fits under existing issues
- Use COMMENTS for updates, progress notes, or additional context
- Only create NEW ISSUES when:
  * It's a completely new, unrelated topic
  * It's a major new feature or bug that doesn't fit existing issues
  * It's a high-priority item that needs separate tracking

STATE SELECTION RULES:
- Always recommend a desired state for each operation when relevant (e.g., "In Progress", "Todo", "Backlog", "Done", "Canceled", "Blocked")
- Prefer "In Progress" when someone is assigned to start working now
- Prefer "Todo" for near-term planned work
- Avoid defaulting to "Backlog" unless explicitly discussed as deferred
- If the workspace uses different state names, provide the best matching generic category (todo | in_progress | done | canceled | blocked)

STRICT MATCHING RULES (to avoid wrong updates/comments):
- Compute a matching confidence (0–1) for linking an action item to an existing issue, based on title/topic similarity, project/component, assignee, labels, and any explicit issue IDs mentioned
- Only UPDATE or COMMENT on an existing issue if matching_confidence ≥ 0.7
- If confidence < 0.7, do NOT update/comment that issue; either create a subtask under a clearly-related parent (if appropriate) or classify as slack_only_information

CLASSIFICATION:
- Classify items into exactly one of:
  1) linear_operations (create/update/comment/subtask)
  2) slack_only_messages (informational notes that should be shared via Slack but NOT added to Linear)
  3) ignore_items (not actionable)

Instructions:
1. First, call LINEAR_LIST_LINEAR_ISSUES to get current issues
2. Analyze the action items against existing issues to determine:
   - Which existing issues should be UPDATED (with issue IDs)
   - Which existing issues should have COMMENTS added (with issue IDs and comment content)
   - Which existing issues should have SUBTASKS created (with parent issue IDs)
   - Which NEW issues should be created (only if truly new/unrelated topics)
   - Which items are slack_only_messages (share to Slack only, not Linear)
3. Provide detailed execution instructions including:
   - Specific issue IDs for updates and comments
   - Parent issue IDs and subtask details for subtasks
   - Complete details for new issues (title, description, assignee, priority) - only when necessary
   - desired_state_name and/or state_category for each operation that creates/updates an issue
   - matching_confidence (0–1) and matching_reason for any operation that references an existing issue

PRIORITY ORDER:
1. Update existing issues (status/state, assignee, priority, description)
2. Add comments to existing issues (progress updates, context, notes)
3. Create subtasks under existing issues (related work, smaller tasks)
4. Create new issues (only for truly new/unrelated topics)

OUTPUT FORMAT (return ONLY a JSON object, no prose):
{
  "linear_operations": [
    {
      "operation": "update_issue" | "add_comment" | "create_subtask" | "create_issue",
      "issue_id": "ID-if-update-or-comment",
      "parent_issue_id": "ID-if-subtask",
      "new_issue": { "title": "...", "description": "...", "assignee": "name or id", "priority": 0-4 },
      "comment": "comment text if add_comment",
      "desired_state_name": "In Progress | Todo | Backlog | Done | Canceled | Blocked",
      "state_category": "in_progress | todo | backlog | done | canceled | blocked",
      "matching_confidence": 0.0,
      "matching_reason": "why this matches the referenced issue"
    }
  ],
  "slack_only_messages": ["..."],
  "ignore_items": ["..."]
}`;
  }

  /**
   * Analyze action items with existing Linear issues context
   */
  async analyzeActionItemsWithContext(actionItems, meetingId) {
    try {
      console.log(`[MeetingSummarizer] Analyzing action items with Linear context (meetingId: ${meetingId})`);
      
      const analysisPrompt = `
Analyze these action items and produce ONLY a JSON object following the OUTPUT FORMAT in your system prompt.

ACTION ITEMS:
${actionItems}

MEETING ID: ${meetingId}

Requirements:
1. First, call LINEAR_LIST_LINEAR_ISSUES to gather context
2. Classify items into linear_operations, slack_only_messages, ignore_items
3. For linear_operations, include desired_state_name/state_category and matching_confidence/matching_reason when referencing existing issues
4. Avoid defaulting to Backlog; recommend appropriate states
5. Return ONLY JSON (no prose). If uncertain, put content in slack_only_messages.
`;

      const result = await this.analysisAgent.invoke({
        messages: [{ role: "user", content: analysisPrompt }]
      });

      console.log('[MeetingSummarizer] Analysis completed successfully');
      return {
        success: true,
        analysis: result.messages[result.messages.length - 1].content
      };
    } catch (error) {
      console.error(`[MeetingSummarizer] Error analyzing action items with context (meetingId: ${meetingId}):`, error);
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
      console.log(`[MeetingSummarizer] Creating meeting summary for transcript (length: ${formattedTranscript.length}):`, formattedTranscript.length > 500 ? formattedTranscript.slice(0, 500) + '...[truncated]' : formattedTranscript);
      const prompt = `You are an expert assistant tasked with generating a clear, structured, and professional summary of a technical meeting from a transcript.\nYour mission is to produce a summary that matches the style used by the team. The expected format contains four distinct sections:\n\n**1. Key takeaways**\nList the key lessons from the meeting in English, in clear and concise paragraphs. Each paragraph should summarize a central idea, including the names of the people involved, their roles, and the objectives discussed. Maintain a professional and analytical tone. If the meeting is technical, mention tools, bugs, APIs, workflows, or proposed solutions.\n\n**2. Action items**\nList concrete actions assigned to each participant, as bullet points, starting each item with the full name of the person concerned. Use infinitive verbs to formulate the action.\n\n**3. Small talk**\nIndicate "None" if no informal exchanges took place. Otherwise, briefly summarize non-technical discussions.\n\n**4. Summary**\nWrite a summary structured by theme. Structure it with clear headings (for example: "Local Deployment", "Event-Driven Architecture", "Technical Issues", "Transcription Management", etc.), followed by timestamped points if available (for example, 2:17). Use an informative and precise tone. Mention decisions made, problems identified, solutions proposed, and next steps. The summary should reflect the full richness of the meeting.\n\n---\n\nDo not start responding until you have fully understood the entire transcript provided. If the transcript contains errors or inconsistencies, correct them in the summary.\nYou must ALWAYS respect the above format.\n\nMEETING TRANSCRIPT:\n${formattedTranscript}`;
      const result = await this.llm.invoke(prompt);
      console.log('[MeetingSummarizer] Summary generated successfully (length:', result.content.length, '):', result.content.length > 500 ? result.content.slice(0, 500) + '...[truncated]' : result.content);
      return {
        success: true,
        summary: result.content,
        formattedTranscript: formattedTranscript
      };
    } catch (error) {
      console.error('[MeetingSummarizer] Error creating summary:', error);
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
      console.log(`[MeetingSummarizer] Extracting action items from summary (meetingId: ${meetingId}, length: ${summary.length}):`, summary.length > 500 ? summary.slice(0, 500) + '...[truncated]' : summary);
      const prompt = `Analyze this meeting summary and extract specific, actionable items that should be created as tasks or issues in project management tools.\n\nMEETING SUMMARY:\n${summary}\n\nMEETING ID: ${meetingId}\n\nPlease extract:\n1. **Specific Action Items**: Concrete tasks that need to be completed\n2. **Bug Reports**: Issues or bugs that were identified and need fixing\n3. **Feature Requests**: New features or improvements that were discussed\n4. **Follow-up Tasks**: Items that require follow-up or investigation\n\nFor each item, provide:\n- **Title**: Clear, concise title for the task/issue\n- **Description**: Detailed description including context from the meeting\n- **Priority**: Estimated priority based on the discussion (High, Medium, Low)\n- **Type**: Whether it's a task, bug, feature, or follow-up\n- **Assignee**: If mentioned in the meeting\n- **Due Date**: If mentioned or can be inferred\n\nFormat your response as a structured list that can be easily processed by project management tools.`;
      const result = await this.llm.invoke(prompt);
      console.log('[MeetingSummarizer] Action items extracted successfully (length:', result.content.length, '):', result.content.length > 500 ? result.content.slice(0, 500) + '...[truncated]' : result.content);
      return {
        success: true,
        actionItems: result.content
      };
    } catch (error) {
      console.error(`[MeetingSummarizer] Error extracting action items (meetingId: ${meetingId}):`, error);
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