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
  async (args) => {
    const cleaned = { ...args };
    // Drop null/undefined optional fields
    Object.keys(cleaned).forEach((k) => {
      if (cleaned[k] === null || cleaned[k] === undefined || cleaned[k] === 'null') {
        delete cleaned[k];
      }
    });
    // Normalize assignee_id: must be a single string
    if (typeof cleaned.assignee_id === 'string') {
      if (cleaned.assignee_id.includes(',')) {
        cleaned.assignee_id = cleaned.assignee_id.split(',')[0].trim();
      }
      if (cleaned.assignee_id.trim() === '') {
        delete cleaned.assignee_id;
      }
    }
    // Ensure priority is within 0-4 if provided
    if (typeof cleaned.priority !== 'undefined') {
      const p = Number(cleaned.priority);
      if (Number.isFinite(p)) {
        cleaned.priority = Math.max(0, Math.min(4, Math.round(p)));
      } else {
        delete cleaned.priority;
      }
    }
    return executeComposioTool('LINEAR_CREATE_LINEAR_ISSUE', cleaned);
  },
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
  async (args) => {
    const cleaned = { ...args };
    // Required issue_id must be present and non-empty
    if (!cleaned.issue_id || typeof cleaned.issue_id !== 'string' || cleaned.issue_id.trim() === '') {
      throw new Error('issue_id is required for LINEAR_UPDATE_ISSUE');
    }
    // Drop null/undefined optional fields
    Object.keys(cleaned).forEach((k) => {
      if (cleaned[k] === null || cleaned[k] === undefined || cleaned[k] === 'null') {
        delete cleaned[k];
      }
    });
    // Normalize assignee_id: must be a single string
    if (typeof cleaned.assignee_id === 'string') {
      if (cleaned.assignee_id.includes(',')) {
        cleaned.assignee_id = cleaned.assignee_id.split(',')[0].trim();
      }
      if (cleaned.assignee_id.trim() === '') {
        delete cleaned.assignee_id;
      }
    }
    // Ensure priority is within 0-4 if provided
    if (typeof cleaned.priority !== 'undefined') {
      const p = Number(cleaned.priority);
      if (Number.isFinite(p)) {
        cleaned.priority = Math.max(0, Math.min(4, Math.round(p)));
      } else {
        delete cleaned.priority;
      }
    }
    return executeComposioTool('LINEAR_UPDATE_ISSUE', cleaned);
  },
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

// Notion Tools
export const notionCreateDatabase = tool(
  async (args) => executeComposioTool('NOTION_CREATE_DATABASE', args),
  {
    name: "NOTION_CREATE_DATABASE",
    description: "Create a new Notion database with specified properties",
    schema: z.object({
      parent_id: z.string().describe("ID of the parent page where the database will be created"),
      title: z.string().describe("Title of the new database"),
      properties: z.array(z.object({
        name: z.string().describe("Name of the property"),
        type: z.enum([
          "title", "rich_text", "number", "select", "multi_select", "date", 
          "people", "files", "checkbox", "url", "email", "phone_number", 
          "formula", "relation", "rollup", "status", "created_time", 
          "created_by", "last_edited_time"
        ]).describe("Type of the property"),
        database_id: z.string().optional().describe("Database ID for relation type"),
        relation_type: z.string().optional().describe("Relation type for relation properties"),
      })).describe("Array of property definitions for the database"),
    }),
  }
);

export const notionInsertRowDatabase = tool(
  async (args) => executeComposioTool('NOTION_INSERT_ROW_DATABASE', args),
  {
    name: "NOTION_INSERT_ROW_DATABASE",
    description: "Create a new page (row) in a Notion database",
    schema: z.object({
      database_id: z.string().describe("ID of the database to insert the row into"),
      properties: z.array(z.object({
        name: z.string().describe("Name of the property"),
        type: z.enum([
          "title", "rich_text", "number", "select", "multi_select", "date", 
          "people", "files", "checkbox", "url", "email", "phone_number", 
          "formula", "relation", "rollup", "status", "created_time", 
          "created_by", "last_edited_time"
        ]).describe("Type of the property"),
        value: z.string().describe("Value of the property (formatted according to type)"),
      })).describe("Array of property values for the new row"),
      icon: z.string().optional().describe("Emoji icon for the page"),
      cover: z.string().optional().describe("URL of cover image"),
      child_blocks: z.array(z.object({
        block_property: z.string().optional().describe("Type of content block"),
        content: z.string().optional().describe("Content text"),
        bold: z.boolean().optional().describe("Bold formatting"),
        italic: z.boolean().optional().describe("Italic formatting"),
        code: z.boolean().optional().describe("Code formatting"),
        color: z.string().optional().describe("Text color"),
        link: z.string().optional().describe("URL link"),
        strikethrough: z.boolean().optional().describe("Strikethrough formatting"),
        underline: z.boolean().optional().describe("Underline formatting"),
      })).optional().describe("Array of content blocks for the page body"),
    }),
  }
);

export const notionUpdateRowDatabase = tool(
  async (args) => executeComposioTool('NOTION_UPDATE_ROW_DATABASE', args),
  {
    name: "NOTION_UPDATE_ROW_DATABASE",
    description: "Update an existing page (row) in a Notion database",
    schema: z.object({
      row_id: z.string().describe("ID of the page/row to update"),
      properties: z.array(z.object({
        name: z.string().describe("Name of the property to update"),
        type: z.enum([
          "title", "rich_text", "number", "select", "multi_select", "date", 
          "people", "files", "checkbox", "url", "email", "phone_number", 
          "formula", "relation", "rollup", "status", "created_time", 
          "created_by", "last_edited_time"
        ]).describe("Type of the property"),
        value: z.string().describe("New value of the property"),
      })).optional().describe("Array of property values to update"),
      icon: z.string().optional().describe("New emoji icon for the page"),
      cover: z.string().optional().describe("New cover image URL"),
      delete_row: z.boolean().optional().describe("Set to true to archive/delete the row"),
    }),
  }
);

export const notionQueryDatabase = tool(
  async (args) => executeComposioTool('NOTION_QUERY_DATABASE', args),
  {
    name: "NOTION_QUERY_DATABASE",
    description: "Query a Notion database for pages (rows)",
    schema: z.object({
      database_id: z.string().describe("ID of the database to query"),
      page_size: z.number().optional().describe("Maximum number of items to return"),
      start_cursor: z.string().optional().describe("Cursor for pagination"),
      sorts: z.array(z.object({
        property_name: z.string().describe("Name of the property to sort by"),
        ascending: z.boolean().describe("Sort direction (true for ascending)"),
      })).optional().describe("Array of sort rules"),
    }),
  }
);

export const notionCreatePage = tool(
  async (args) => executeComposioTool('NOTION_CREATE_NOTION_PAGE', args),
  {
    name: "NOTION_CREATE_NOTION_PAGE",
    description: "Create a new empty page in Notion",
    schema: z.object({
      parent_id: z.string().describe("ID of the parent page or database"),
      title: z.string().describe("Title of the new page"),
      icon: z.string().optional().describe("Emoji icon for the page"),
      cover: z.string().optional().describe("URL of cover image"),
    }),
  }
);

export const notionAddPageContent = tool(
  async (args) => executeComposioTool('NOTION_ADD_PAGE_CONTENT', args),
  {
    name: "NOTION_ADD_PAGE_CONTENT",
    description: "Add content blocks to a Notion page",
    schema: z.object({
      parent_block_id: z.string().describe("ID of the parent page or block"),
      content_block: z.object({
        block_property: z.string().optional().describe("Type of content block"),
        content: z.string().optional().describe("Content text"),
        bold: z.boolean().optional().describe("Bold formatting"),
        italic: z.boolean().optional().describe("Italic formatting"),
        code: z.boolean().optional().describe("Code formatting"),
        color: z.string().optional().describe("Text color"),
        link: z.string().optional().describe("URL link"),
        strikethrough: z.boolean().optional().describe("Strikethrough formatting"),
        underline: z.boolean().optional().describe("Underline formatting"),
      }).describe("Content block to add"),
      after: z.string().optional().describe("ID of block to insert after"),
    }),
  }
);

export const notionCreateComment = tool(
  async (args) => executeComposioTool('NOTION_CREATE_COMMENT', args),
  {
    name: "NOTION_CREATE_COMMENT",
    description: "Add a comment to a Notion page or discussion",
    schema: z.object({
      comment: z.object({
        content: z.string().describe("Comment text"),
        bold: z.boolean().optional().describe("Bold formatting"),
        italic: z.boolean().optional().describe("Italic formatting"),
        code: z.boolean().optional().describe("Code formatting"),
        color: z.string().optional().describe("Text color"),
        link: z.string().optional().describe("URL link"),
        strikethrough: z.boolean().optional().describe("Strikethrough formatting"),
        underline: z.boolean().optional().describe("Underline formatting"),
      }).describe("Comment content"),
      parent_page_id: z.string().optional().describe("ID of the page to comment on"),
      discussion_id: z.string().optional().describe("ID of the discussion thread"),
    }),
  }
);

export const notionSearchPages = tool(
  async (args) => executeComposioTool('NOTION_SEARCH_NOTION_PAGE', args),
  {
    name: "NOTION_SEARCH_NOTION_PAGE",
    description: "Search for Notion pages and databases (empty query lists all accessible items)",
    schema: z.object({
      query: z.string().optional().describe("Search query text (empty returns all)"),
      filter_property: z.string().optional().describe("Property to filter by (defaults to object)"),
      filter_value: z.string().optional().describe("Value to filter by (page or database)"),
      page_size: z.number().optional().describe("Maximum number of results"),
      start_cursor: z.string().optional().describe("Cursor for pagination"),
      timestamp: z.string().optional().describe("Timestamp field to sort by"),
      direction: z.string().optional().describe("Sort direction (ascending/descending)"),
    }),
  }
);

// New: Fetch child blocks of a page/block (to locate embedded databases)
export const notionFetchBlockContents = tool(
  async (args) => executeComposioTool('NOTION_FETCH_BLOCK_CONTENTS', args),
  {
    name: "NOTION_FETCH_BLOCK_CONTENTS",
    description: "Fetch first-level child blocks of a page/block; use to find embedded databases or content",
    schema: z.object({
      block_id: z.string().describe("ID of the parent page or block"),
      page_size: z.number().optional().describe("Max number of child blocks"),
      start_cursor: z.string().optional().describe("Cursor for pagination"),
    }),
  }
);

// New: Update page (rename, icon, cover, archive)
export const notionUpdatePage = tool(
  async (args) => executeComposioTool('NOTION_UPDATE_PAGE', args),
  {
    name: "NOTION_UPDATE_PAGE",
    description: "Update page properties, including title (via properties), icon, cover, or archive status",
    schema: z.object({
      page_id: z.string().describe("Identifier for the Notion page to be updated"),
      properties: z.record(z.any()).optional().describe("Property values to update (e.g., { Name: { title: [{ text: { content: 'New Title' } }] } })"),
      icon: z.record(z.any()).optional().describe("Emoji or external icon object"),
      cover: z.record(z.any()).optional().describe("External file object for cover"),
      archived: z.boolean().optional().describe("Archive or restore page"),
    }),
  }
);

// New: Fetch data (pages/databases) helper
export const notionFetchData = tool(
  async (args) => executeComposioTool('NOTION_FETCH_DATA', args),
  {
    name: "NOTION_FETCH_DATA",
    description: "Fetch Notion data (pages and/or databases) with simplified parameters",
    schema: z.object({
      get_all: z.boolean().optional().describe("If true, fetches all accessible items"),
      get_databases: z.boolean().optional().describe("If true, fetches databases"),
      get_pages: z.boolean().optional().describe("If true, fetches pages"),
      page_size: z.number().optional().describe("Max results per page"),
      query: z.string().optional().describe("Optional search query"),
    }),
  }
);

// Export Notion tools
export const notionTools = [
  notionCreateDatabase,
  notionInsertRowDatabase,
  notionUpdateRowDatabase,
  notionQueryDatabase,
  notionCreatePage,
  notionAddPageContent,
  notionCreateComment,
  notionSearchPages,
  notionFetchBlockContents,
  notionUpdatePage,
  notionFetchData,
]; 

// Jira Tools
export const jiraGetIssues = tool(
  async (args) => executeComposioTool('JIRA_LIST_ISSUES', args),
  {
    name: "JIRA_LIST_ISSUES",
    description: "Retrieve Jira issues with filtering and search capabilities",
    schema: z.object({
      jql: z.string().optional().describe("JQL query string for filtering issues"),
      max_results: z.number().optional().describe("Maximum number of issues to return"),
      start_at: z.number().optional().describe("Starting index for pagination"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
  }
);

export const jiraCreateIssue = tool(
  async (args) => {
    const cleaned = { ...args };
    // Drop null/undefined optional fields
    Object.keys(cleaned).forEach((k) => {
      if (cleaned[k] === null || cleaned[k] === undefined || cleaned[k] === 'null') {
        delete cleaned[k];
      }
    });
    // Ensure priority is within valid range if provided
    if (typeof cleaned.priority !== 'undefined') {
      const p = Number(cleaned.priority);
      if (Number.isFinite(p)) {
        cleaned.priority = Math.max(1, Math.min(5, Math.round(p))); // Jira uses 1-5
      } else {
        delete cleaned.priority;
      }
    }
    return executeComposioTool('JIRA_CREATE_ISSUE', cleaned);
  },
  {
    name: "JIRA_CREATE_ISSUE",
    description: "Create a new Jira issue",
    schema: z.object({
      summary: z.string().describe("Summary/title of the issue"),
      description: z.string().optional().describe("Description of the issue"),
      project_key: z.string().describe("Project key (e.g., 'PROJ')"),
      issue_type: z.string().describe("Type of issue (e.g., 'Story', 'Bug', 'Task')"),
      priority: z.string().optional().describe("Priority level (e.g., 'Low', 'Medium', 'High')"),
      assignee: z.string().optional().describe("Username or email of assignee"),
      reporter: z.string().optional().describe("Username or email of reporter"),
      labels: z.array(z.string()).optional().describe("Array of label strings"),
      components: z.array(z.string()).optional().describe("Array of component names"),
      due_date: z.string().optional().describe("Due date for the issue"),
      environment: z.string().optional().describe("Environment information"),
    }),
  }
);

export const jiraUpdateIssue = tool(
  async (args) => {
    const cleaned = { ...args };
    // Required issue_key must be present
    if (!cleaned.issue_id_or_key) {
      throw new Error('Missing issue_id_or_key for JIRA_UPDATE_ISSUE');
    }
    // Drop null/undefined optional fields
    Object.keys(cleaned).forEach((k) => {
      if (cleaned[k] === null || cleaned[k] === undefined || cleaned[k] === 'null') {
        delete cleaned[k];
      }
    });
    return executeComposioTool('JIRA_UPDATE_ISSUE', cleaned);
  },
  {
    name: "JIRA_UPDATE_ISSUE",
    description: "Update an existing Jira issue",
    schema: z.object({
      issue_id_or_key: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
      summary: z.string().optional().describe("New summary/title"),
      description: z.string().optional().describe("New description"),
      priority: z.string().optional().describe("New priority level"),
      assignee: z.string().optional().describe("New assignee username/email"),
      labels: z.array(z.string()).optional().describe("New array of labels"),
      components: z.array(z.string()).optional().describe("New array of components"),
      due_date: z.string().optional().describe("New due date"),
      environment: z.string().optional().describe("New environment information"),
    }),
  }
);

export const jiraAddComment = tool(
  async (args) => executeComposioTool('JIRA_ADD_COMMENT', args),
  {
    name: "JIRA_ADD_COMMENT",
    description: "Add a comment to a Jira issue",
    schema: z.object({
      issue_id_or_key: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
      comment: z.string().describe("Comment text to add"),
      visibility_type: z.string().optional().describe("Visibility type (e.g., 'role', 'group')"),
      visibility_value: z.string().optional().describe("Role or group name for visibility"),
    }),
  }
);

export const jiraAssignIssue = tool(
  async (args) => executeComposioTool('JIRA_ASSIGN_ISSUE', args),
  {
    name: "JIRA_ASSIGN_ISSUE",
    description: "Assign a Jira issue to a user",
    schema: z.object({
      issue_id_or_key: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
      assignee_name: z.string().optional().describe("Username or email of assignee"),
      account_id: z.string().optional().describe("Account ID of assignee"),
    }),
  }
);

export const jiraGetProjects = tool(
  async (args) => executeComposioTool('JIRA_LIST_PROJECTS', args),
  {
    name: "JIRA_LIST_PROJECTS",
    description: "List available Jira projects",
    schema: z.object({
      include_archived: z.boolean().optional().describe("Include archived projects"),
      expand: z.string().optional().describe("Additional fields to expand"),
    }),
  }
);

export const jiraGetIssueTypes = tool(
  async (args) => executeComposioTool('JIRA_LIST_ISSUE_TYPES', args),
  {
    name: "JIRA_LIST_ISSUE_TYPES",
    description: "List available Jira issue types",
    schema: z.object({
      project_id: z.string().optional().describe("Project ID to filter issue types"),
    }),
  }
);

export const jiraGetStatuses = tool(
  async (args) => executeComposioTool('JIRA_LIST_STATUSES', args),
  {
    name: "JIRA_LIST_STATUSES",
    description: "List available Jira statuses",
    schema: z.object({
      project_id: z.string().optional().describe("Project ID to filter statuses"),
    }),
  }
);

// Export Jira tools
export const jiraTools = [
  jiraGetIssues,
  jiraCreateIssue,
  jiraUpdateIssue,
  jiraAddComment,
  jiraAssignIssue,
  jiraGetProjects,
  jiraGetIssueTypes,
  jiraGetStatuses,
]; 