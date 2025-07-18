import { createHandoffTool } from "@langchain/langgraph-swarm";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { linearTools } from "../tools/composioTools.js";

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
  tools: [...linearTools, transferToClickUpAssistant],
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

AVAILABLE TOOLS:
- LINEAR_LIST_LINEAR_PROJECTS: List projects with their teams and IDs (start here to get project_id)
- LINEAR_LIST_LINEAR_TEAMS: Get team information using project_id (needed for creating issues)
- LINEAR_LIST_LINEAR_ISSUES: List existing Linear issues in the workspace (filter by project if needed)
- LINEAR_LIST_LINEAR_STATES: Get all possible states (To Do, In Progress, Done, etc.) with their UUIDs (requires team_id)
- LINEAR_CREATE_LINEAR_ISSUE: Create new Linear issues (requires: title, description, team_id, project_id, and optionally state_id, parent_id for subtasks, priority as number 0-4)
- LINEAR_UPDATE_ISSUE: Update existing issues (status using state_id, priority, parent_id for converting to subtask, etc.)
- LINEAR_DELETE_LINEAR_ISSUE: Delete issues by ID when they are no longer needed
- LINEAR_CREATE_LINEAR_COMMENT: Add comments to existing issues by issue_id (use for progress updates, notes, clarifications)

WORKFLOW:
1. **DISCOVERY** (do this ONCE only):
   - Get project info using LINEAR_LIST_LINEAR_PROJECTS for "Agent Test" project (save project_id)
   - Get team info using LINEAR_LIST_LINEAR_TEAMS with project_id (save team_id)
   - List existing issues using LINEAR_LIST_LINEAR_ISSUES
   - Get available states using LINEAR_LIST_LINEAR_STATES with team_id (save state_ids)

2. **EXECUTION** (based on meeting summary):
   - Create new issues for action items mentioned in summary
   - Use project_id and team_id from discovery phase
   - Use priority numbers: 0=No priority, 1=Low, 2=Medium, 3=High, 4=Urgent
   - Update existing issues if mentioned in summary
   - Add comments to issues if needed
   - Delete issues if mentioned as cancelled in summary

3. **COMPLETION**:
   - Provide a clear summary of all actions taken
   - STOP executing tools once you have completed all required actions

IMPORTANT RULES:
- Work on the "Agent Test" project (project_id from discovery)
- Always use both project_id and team_id when creating issues
- Use priority as numbers (0-4), not strings
- When a tool succeeds (shows ✅), do NOT call it again with the same parameters
- If you get the information you need, proceed to the next step
- If a tool fails, try once more, then move on
- Be efficient - don't over-execute tools
- STOP when you have completed all required actions
- Transfer to ClickUp assistant when users need ClickUp task management`,
  name: "linear_assistant",
}); 