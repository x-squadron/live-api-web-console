import { Type, Tool, Schema } from "@google/genai";
import { OpenAIToolSet } from "composio-core";
import { isArray } from "lodash";
import { ChatCompletionTool } from "openai/resources/chat";
import { MCP_ACTIONS } from "./mcp-actions";

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
          // console.log("[getDefaultTools] composio tool: ", tool);
          return {
            name: tool.function.name,
            description: tool.function.description,
            parameters: Object.entries(
              tool.function.parameters ?? {}
            ).reduce<Schema>(
              (accumulator, item) => {
                // console.log("item:", item);
                const [key, value] = item;
                if (
                  key === "properties" &&
                  typeof value === "object" &&
                  !!value
                ) {
                  for (let [propertyName, definition] of Object.entries(
                    value
                  )) {
                    delete definition.examples;
                    accumulator.properties![propertyName] = definition;
                  }
                }
                if (key === "required" && isArray(value)) {
                  accumulator.required?.concat(value);
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
