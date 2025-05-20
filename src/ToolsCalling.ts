import {
  FunctionDeclarationSchema,
  SchemaType,
  Tool,
} from "@google/generative-ai";
import { OpenAIToolSet } from "composio-core";
import { ChatCompletion, ChatCompletionTool } from "openai/resources/chat";

export async function getDefaultTools(): Promise<Tool[]> {
  const composioApiKey = process.env.REACT_APP_COMPOSIO_API_KEY;
  const composioToolset = new OpenAIToolSet({
    apiKey: composioApiKey,
  });

  const composioTools = await composioToolset.getTools({
    actions: [
      "GOOGLECALENDAR_FIND_FREE_SLOTS",
      "GOOGLECALENDAR_CREATE_EVENT",
      "GOOGLECALENDAR_DELETE_EVENT",
      "GOOGLECALENDAR_FIND_EVENT",
    ],
  });

  return [
    {
      functionDeclarations: composioTools.map((tool: ChatCompletionTool) => {
        console.log("tools: ", tool.function.parameters);
        return {
          name: tool.function.name,
          description: tool.function.description,
          parameters: Object.entries(
            tool.function.parameters ?? {}
          ).reduce<FunctionDeclarationSchema>(
            (accumulator, [key, value]) => {
              if (typeof value === "string") {
                accumulator.properties[key] = {
                  type: SchemaType.STRING,
                  description: value,
                };
              } else if (typeof value === "boolean") {
                accumulator.properties[key] = {
                  type: SchemaType.BOOLEAN,
                  //   description: value,
                };
              }
              return accumulator;
            },
            { type: SchemaType.OBJECT, properties: {} }
          ),
        };
      }),
    },
  ];
}
