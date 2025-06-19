import { Type, Tool, Schema } from "@google/genai";
import { OpenAIToolSet } from "composio-core";
import { isArray } from "lodash";
import { ChatCompletionTool } from "openai/resources/chat";
import { MCP_ACTIONS } from "./mcp-actions";

// Recursively remove 'examples' fields from any object
function removeExamples(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeExamples);
  }

  const cleaned: any = {};
  for (let [key, value] of Object.entries(obj)) {
    if (key === "examples") {
      // Skip the examples field entirely
      continue;
    }
    if (["attendees"].includes(key)) {
      // Skip the examples field entirely
      // we do this to avoid
      // server.closedisconnected with reason: *
      // BidiGenerateContentRequest.setup.tools[0].function_declarations[5].parameters.properties[attendees].
      // items: missing field.
      continue;
    }
    if (key === "exclusiveMinimum") {
      obj["minimum"] = obj[key];
      delete obj[key];
      return obj;
    }
    cleaned[key] = removeExamples(value);
  }

  return cleaned;
}

export async function getDefaultTools(
  toolset: OpenAIToolSet,
  actions: MCP_ACTIONS[]
): Promise<Tool[]> {
  console.log("[getDefaultTools] actions:", actions);
  const composioTools = await toolset.getTools({
    actions,
  });

  return [
    {
      functionDeclarations: composioTools
        // .slice(1, 2)
        .map((tool: ChatCompletionTool) => {
          console.log("[getDefaultTools] composio tool: ", tool);

          // Clean the entire tool function parameters to remove all examples
          const cleanedParameters = removeExamples(
            tool.function.parameters ?? {}
          );

          return {
            name: tool.function.name,
            description: tool.function.description,
            parameters: Object.entries(cleanedParameters).reduce<Schema>(
              (accumulator, item) => {
                const [key, value] = item;
                if (
                  key === "properties" &&
                  typeof value === "object" &&
                  !!value
                ) {
                  for (let [propertyName, definition] of Object.entries(
                    value
                  )) {
                    accumulator.properties![propertyName] = definition;
                  }
                }
                if (key === "required" && isArray(value)) {
                  accumulator.required = [
                    ...(accumulator.required ?? []),
                    ...value,
                  ];
                }
                if (key === "type") {
                  accumulator.type = value as Type;
                }
                return accumulator;
              },
              { type: Type.OBJECT, properties: {}, required: [] }
            ),
          };
        }),
    },
  ];
}
