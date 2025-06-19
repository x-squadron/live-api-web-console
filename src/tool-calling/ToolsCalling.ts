import { Type, Tool, Schema } from "@google/genai";
import { OpenAIToolSet } from "composio-core";
import { isArray } from "lodash";
import { ChatCompletionTool } from "openai/resources/chat";
import { MCP_ACTIONS } from "./mcp-actions";
import { createDynamicA2ATools } from "./DynamicA2ATools";

// List of known problematic tools that cause syntax errors
const PROBLEMATIC_TOOLS = [
  // Tools with malformed type annotations
  'GMAIL_SEND_EMAIL',
  'GMAIL_CREATE_DRAFT',
  'GMAIL_REPLY_TO_EMAIL',
  'GMAIL_FORWARD_EMAIL',
  'GMAIL_SEARCH_EMAILS',
  // Add more as we discover them
];

// Recursively remove 'examples' fields from any object
function removeExamples(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeExamples);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "examples") {
      // Skip the examples field entirely
      continue;
    }
    cleaned[key] = removeExamples(value);
  }

  return cleaned;
}

// Filter out problematic tools before processing
function filterProblematicTools(actions: MCP_ACTIONS[]): MCP_ACTIONS[] {
  const filtered = actions.filter(action => !PROBLEMATIC_TOOLS.includes(action));
  
  if (filtered.length !== actions.length) {
    const removed = actions.filter(action => PROBLEMATIC_TOOLS.includes(action));
    console.log(`[getDefaultTools] Filtered out problematic tools: ${removed.join(', ')}`);
    console.log(`[getDefaultTools] Remaining tools: ${filtered.length}/${actions.length}`);
  }
  
  return filtered;
}

export async function getDefaultTools(
  toolset: OpenAIToolSet,
  actions: MCP_ACTIONS[]
): Promise<Tool[]> {
  const isA2AEnabled = process.env.REACT_APP_A2A_ENABLED === 'true';
  
  // TEMPORARY FIX: Always show both A2A and Composio tools until A2A is fully working
  console.log("[getDefaultTools] TEMP FIX: Loading both A2A delegation tools AND direct Composio tools");
  console.log(`[getDefaultTools] A2A enabled: ${isA2AEnabled}, Actions available: ${actions.length}`);
  
  const tools: Tool[] = [];
  
  // Add A2A delegation tools if enabled
  if (isA2AEnabled) {
    try {
      const a2aTools = await createDynamicA2ATools();
      tools.push(...a2aTools);
      console.log(`[getDefaultTools] Added ${a2aTools.length} A2A delegation tools`);
    } catch (error) {
      console.error("[getDefaultTools] Failed to create A2A tools:", error);
    }
  }
  
  // Add direct Composio tools as backup (with rate limiting protection)
  try {
    const filteredActions = filterProblematicTools(actions);
    
    if (filteredActions.length > 0) {
      console.log(`[getDefaultTools] Converting ${filteredActions.length} Composio tools...`);
      
      // Rate limit the tool conversion
      const composioToolset = await Promise.race([
        toolset.getTools({ actions: filteredActions }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Composio tool conversion timeout')), 10000)
        )
      ]) as ChatCompletionTool[];

      const convertedTools = composioToolset.map((tool) => {
        const cleanedTool = removeExamples(tool);

        return {
          name: cleanedTool.function.name,
          description: cleanedTool.function.description,
          parameters: cleanedTool.function.parameters as Schema,
        } as Tool;
      });

      tools.push(...convertedTools);
      console.log(`[getDefaultTools] Added ${convertedTools.length} direct Composio tools`);
    }
  } catch (error: any) {
    console.error("[getDefaultTools] Failed to get Composio tools:", error);
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      console.warn("[getDefaultTools] Rate limit detected - tools will be available when rate limit resets");
    }
  }
  
  console.log(`[getDefaultTools] Total tools available: ${tools.length}`);
  
  if (tools.length === 0) {
    console.warn("[getDefaultTools] No tools available! Check:");
    console.warn("  - REACT_APP_A2A_ENABLED environment variable");
    console.warn("  - Composio API rate limits");
    console.warn("  - Network connectivity");
  }
  
  return tools;
}
