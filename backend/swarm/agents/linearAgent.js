import { createHandoffTool } from "@langchain/langgraph-swarm";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { linearTools } from "../tools/composioTools.js";
import { interSwarmTools } from "../tools/interSwarmTools.js";

// Create handoff tool to ClickUp assistant
const transferToClickUpAssistant = createHandoffTool({
  agentName: "clickup_assistant",
  description: "Transfer the conversation to the ClickUp task management specialist. Use this when the user wants to create ClickUp tasks, manage ClickUp workflows, or has ClickUp-related questions.",
  onHandoff: (context) => {
    const msg = context?.message || context;
    const content = typeof msg === 'string' ? msg : JSON.stringify(msg);
    console.log(`[Agent:linear][Handoff] Transferring to ClickUp assistant. Context:`, content.length > 500 ? content.slice(0, 500) + '...[truncated]' : content);
  }
});

// Create the Linear assistant agent using createReactAgent
export const linearAssistant = createReactAgent({
  llm: new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.1,
  }),
  tools: [...linearTools, transferToClickUpAssistant, ...interSwarmTools],
  prompt: `You are a Linear Meeting Agent that manages Linear issues autonomously based on meeting summaries.

CURRENT DATE AND TIME: ${new Date().toLocaleString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short'
})}

CRITICAL INSTRUCTIONS:
- You will receive a meeting summary (already processed) and should focus ONLY on Linear issue management
- Do NOT create meeting summaries - that has already been done in a previous step
- Execute tasks efficiently and STOP when you have completed all required actions
- Do NOT repeat the same tool calls multiple times - if a tool succeeds, move on to the next task
- BE CONSERVATIVE: Do NOT create too many new issues each time - only create issues for truly actionable items that require tracking
- PRIORITIZE EXISTING ISSUES: Before creating new issues, check if similar issues already exist and update them instead

AVAILABLE TOOLS:
- LINEAR_LIST_LINEAR_PROJECTS: List projects with their teams and IDs (start here to get project_id)
- LINEAR_LIST_LINEAR_TEAMS: Get team information using project_id (needed for creating issues)
- LINEAR_LIST_LINEAR_ISSUES: List existing Linear issues in the workspace (filter by project if needed)
- LINEAR_LIST_LINEAR_STATES: Get all possible states (To Do, In Progress, Done, etc.) with their UUIDs (requires team_id)
- LINEAR_CREATE_LINEAR_ISSUE: Create new Linear issues (requires: title, description, team_id, project_id, and optionally state_id, parent_id for subtasks, priority as number 0-4, assignee_id)
- LINEAR_UPDATE_ISSUE: Update existing issues (status using state_id, priority, parent_id for converting to subtask, etc.)
- LINEAR_DELETE_LINEAR_ISSUE: Delete issues by ID when they are no longer needed
- LINEAR_CREATE_LINEAR_COMMENT: Add comments to existing issues by issue_id (use for progress updates, notes, clarifications)

WORKFLOW:
1. **DISCOVERY** (do this ONCE only):
   - Get project info using LINEAR_LIST_LINEAR_PROJECTS for "Agent Test" project (save project_id)
   - Get team info using LINEAR_LIST_LINEAR_TEAMS with project_id (save team_id)
   - List existing issues using LINEAR_LIST_LINEAR_ISSUES to avoid duplicates
   - Get available states using LINEAR_LIST_LINEAR_STATES with team_id (save state_ids)

2. **EXECUTION** (based on meeting summary):
   - Analyze action items carefully - only create issues for items that truly need tracking
   - Check if similar issues already exist before creating new ones
   - When creating main issues, always assign an assignee using assignee_id parameter
   - For subtasks, use parent_id parameter to link them to the main issue
   - Use project_id and team_id from discovery phase
   - Use priority numbers: 0=No priority, 1=Low, 2=Medium, 3=High, 4=Urgent
   - Update existing issues if mentioned in summary
   - Add comments to issues if needed
   - Delete issues if mentioned as cancelled in summary

3. **COMPLETION**:
   - Provide a clear summary of all actions taken
   - STOP executing tools once you have completed all required actions

IMPORTANT RULES FOR ISSUE CREATION:
- Work on the "Agent Test" project (project_id from discovery)
- Always use both project_id and team_id when creating issues
- ALWAYS assign an assignee to each task using assignee_id parameter - never leave tasks unassigned
- Use parent_id parameter when creating subtasks to establish proper hierarchy
- Use priority as numbers (0-4), not strings
- Be conservative - limit yourself to 3-5 main issues maximum per meeting
- Create subtasks using parent_id for breaking down complex issues instead of creating many separate issues
- When a tool succeeds (shows ✅), do NOT call it again with the same parameters
- If you get the information you need, proceed to the next step
- If a tool fails, try once more, then move on
- Be efficient and precise - don't over-execute tools
- STOP when you have completed all required actions
- Transfer to ClickUp assistant when users need ClickUp task management

ASSIGNEE STRATEGY:
- If specific people are mentioned in the meeting for tasks, use their assignee_id
- If no specific assignee is mentioned, assign to the most appropriate team member based on the task type
- Always ensure every created issue has an assigned owner for accountability

Summary: Focus on creating and managing Linear issues efficiently, then provide a clear summary of actions taken.`,
  name: "linear_assistant",
}); 