import { ChatOpenAI } from '@langchain/openai';
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