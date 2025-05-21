import {
  FunctionDeclarationSchema,
  SchemaType,
  Tool,
} from "@google/generative-ai";
import { OpenAIToolSet } from "composio-core";
import { ChatCompletionTool } from "openai/resources/chat";

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
      functionDeclarations: composioTools
        // .slice(0, 1)
        .map((tool: ChatCompletionTool) => {
          // console.log("[getDefaultTools] composio tool: ", tool);
          return {
            name: tool.function.name,
            description: tool.function.description,
            parameters: Object.entries(
              tool.function.parameters ?? {}
            ).reduce<FunctionDeclarationSchema>(
              (accumulator, item) => {
                // console.log("item:", item);
                // const [key, value] = item;
                // if (typeof value === "string") {
                //   accumulator.properties[key] = {
                //     type: SchemaType.STRING,
                //     // description: value,
                //   };
                // } else if (typeof value === "boolean") {
                //   accumulator.properties[key] = {
                //     type: SchemaType.BOOLEAN,
                //     //   description: value,
                //   };
                // }
                // accumulator.required?.push(key);
                return accumulator;
              },
              { type: SchemaType.OBJECT, properties: {}, required: [] }
            ),
          };
        }),
    },
  ];
}
