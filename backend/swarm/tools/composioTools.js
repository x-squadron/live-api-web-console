import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { OpenAIToolSet } from 'composio-core';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Composio toolset
const composioToolset = new OpenAIToolSet({
  apiKey: process.env.COMPOSIO_API_KEY,
});

const userId = process.env.COMPOSIO_ENTITY_ID || 'default_user';

// Helper function to execute Composio tool
async function executeComposioTool(toolName, args) {
  try {
    console.log(`[ComposioTool] Executing ${toolName}:`, args);
    
    const toolCall = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args)
      }
    };
    
    const result = await composioToolset.executeToolCall(toolCall, userId);
    console.log(`[ComposioTool] ${toolName} result:`, result);
    
    return result;
  } catch (error) {
    console.error(`[ComposioTool] Error executing ${toolName}:`, error);
    throw error;
  }
}

// Linear Tools
export const linearGetIssues = tool(
  async (args) => executeComposioTool('LINEAR_LIST_LINEAR_ISSUES', args),
  {
    name: "LINEAR_LIST_LINEAR_ISSUES",
    description: "Retrieve Linear issues with filtering and search capabilities",
    schema: z.object({
      filter: z.object({}).optional().describe("Optional filter criteria for issues"),
      limit: z.number().optional().describe("Maximum number of issues to return"),
    }),
  }
);

export const linearCreateIssue = tool(
  async (args) => executeComposioTool('LINEAR_CREATE_LINEAR_ISSUE', args),
  {
    name: "LINEAR_CREATE_LINEAR_ISSUE",
    description: "Create a new Linear issue",
    schema: z.object({
      title: z.string().describe("Title of the issue"),
      description: z.string().optional().describe("Description of the issue"),
      priority: z.number().min(0).max(4).optional().describe("Priority level (0=No priority, 1=Low, 2=Medium, 3=High, 4=Urgent)"),
      team_id: z.string().describe("Team ID to assign the issue to (required)"),
      project_id: z.string().describe("Project ID to assign the issue to (required)"),
      assignee_id: z.string().optional().describe("User ID to assign the issue to"),
      state_id: z.string().optional().describe("State ID for the issue"),
      parent_id: z.string().optional().describe("Parent issue ID for subtasks"),
    }),
  }
);

export const linearUpdateIssue = tool(
  async (args) => executeComposioTool('LINEAR_UPDATE_ISSUE', args),
  {
    name: "LINEAR_UPDATE_ISSUE",
    description: "Update an existing Linear issue",
    schema: z.object({
      issue_id: z.string().describe("ID of the issue to update"),
      title: z.string().optional().describe("New title for the issue"),
      description: z.string().optional().describe("New description for the issue"),
      priority: z.number().min(0).max(4).optional().describe("New priority level (0=No priority, 1=Low, 2=Medium, 3=High, 4=Urgent)"),
      state_id: z.string().optional().describe("New state ID for the issue"),
      assignee_id: z.string().optional().describe("New assignee ID"),
      parent_id: z.string().optional().describe("Parent issue ID for subtasks"),
    }),
  }
);

export const linearDeleteIssue = tool(
  async (args) => executeComposioTool('LINEAR_DELETE_LINEAR_ISSUE', args),
  {
    name: "LINEAR_DELETE_LINEAR_ISSUE",
    description: "Delete a Linear issue",
    schema: z.object({
      issue_id: z.string().describe("ID of the issue to delete"),
    }),
  }
);

export const linearCreateComment = tool(
  async (args) => executeComposioTool('LINEAR_CREATE_LINEAR_COMMENT', args),
  {
    name: "LINEAR_CREATE_LINEAR_COMMENT",
    description: "Add a comment to a Linear issue",
    schema: z.object({
      issue_id: z.string().describe("ID of the issue to comment on"),
      body: z.string().describe("Comment text"),
    }),
  }
);

export const linearGetTeams = tool(
  async (args) => executeComposioTool('LINEAR_LIST_LINEAR_TEAMS', args),
  {
    name: "LINEAR_LIST_LINEAR_TEAMS",
    description: "Retrieve Linear teams",
    schema: z.object({
      project_id: z.string().optional().describe("Project ID to filter teams"),
    }),
  }
);

export const linearGetProjects = tool(
  async (args) => executeComposioTool('LINEAR_LIST_LINEAR_PROJECTS', args),
  {
    name: "LINEAR_LIST_LINEAR_PROJECTS",
    description: "Retrieve Linear projects",
    schema: z.object({
      filter: z.object({}).optional().describe("Optional filter criteria"),
    }),
  }
);

export const linearGetLabels = tool(
  async (args) => executeComposioTool('LINEAR_GET_LABELS', args),
  {
    name: "LINEAR_GET_LABELS",
    description: "Retrieve Linear labels",
    schema: z.object({
      filter: z.object({}).optional().describe("Optional filter criteria"),
    }),
  }
);

export const linearGetStates = tool(
  async (args) => executeComposioTool('LINEAR_LIST_LINEAR_STATES', args),
  {
    name: "LINEAR_LIST_LINEAR_STATES",
    description: "Retrieve Linear workflow states",
    schema: z.object({
      team_id: z.string().describe("Team ID to get states for (required)"),
    }),
  }
);

// ClickUp Tools
export const clickupCreateTask = tool(
  async (args) => executeComposioTool('CLICKUP_CREATE_TASK', args),
  {
    name: "CLICKUP_CREATE_TASK",
    description: "Create a new ClickUp task",
    schema: z.object({
      name: z.string().describe("Name of the task"),
      description: z.string().optional().describe("Description of the task"),
      priority: z.enum(["urgent", "high", "normal", "low"]).optional().describe("Priority level"),
      assignees: z.array(z.string()).optional().describe("Array of user IDs to assign"),
      dueDate: z.string().optional().describe("Due date in ISO format"),
      tags: z.array(z.string()).optional().describe("Array of tags"),
      listId: z.string().describe("List ID where the task should be created"),
    }),
  }
);

export const clickupUpdateTask = tool(
  async (args) => executeComposioTool('CLICKUP_UPDATE_TASK', args),
  {
    name: "CLICKUP_UPDATE_TASK",
    description: "Update an existing ClickUp task",
    schema: z.object({
      taskId: z.string().describe("ID of the task to update"),
      name: z.string().optional().describe("New name for the task"),
      description: z.string().optional().describe("New description for the task"),
      priority: z.enum(["urgent", "high", "normal", "low"]).optional().describe("New priority level"),
      assignees: z.array(z.string()).optional().describe("New assignees"),
      dueDate: z.string().optional().describe("New due date"),
      status: z.string().optional().describe("New status"),
    }),
  }
);

export const clickupDeleteTask = tool(
  async (args) => executeComposioTool('CLICKUP_DELETE_TASK', args),
  {
    name: "CLICKUP_DELETE_TASK",
    description: "Delete a ClickUp task",
    schema: z.object({
      taskId: z.string().describe("ID of the task to delete"),
    }),
  }
);

export const clickupCreateTaskComment = tool(
  async (args) => executeComposioTool('CLICKUP_CREATE_TASK_COMMENT', args),
  {
    name: "CLICKUP_CREATE_TASK_COMMENT",
    description: "Add a comment to a ClickUp task",
    schema: z.object({
      taskId: z.string().describe("ID of the task to comment on"),
      comment: z.string().describe("Comment text"),
    }),
  }
);

// Export all tools grouped by agent
export const linearTools = [
  linearGetIssues,
  linearCreateIssue,
  linearUpdateIssue,
  linearDeleteIssue,
  linearCreateComment,
  linearGetTeams,
  linearGetProjects,
  linearGetLabels,
  linearGetStates,
];

// Slack Tools
export const slackSendMessage = tool(
  async (args) => executeComposioTool('SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL', args),
  {
    name: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
    description: "Send a message to a Slack channel",
    schema: z.object({
      channel: z.string().describe("Channel ID or channel name to send the message to"),
      text: z.string().describe("Message text to send"),
      attachments: z.array(z.object({})).optional().describe("Optional message attachments"),
      blocks: z.array(z.object({})).optional().describe("Optional message blocks for rich formatting"),
    }),
  }
);

export const clickupTools = [
  clickupCreateTask,
  clickupUpdateTask,
  clickupDeleteTask,
  clickupCreateTaskComment,
];

export const slackTools = [
  slackSendMessage,
]; 