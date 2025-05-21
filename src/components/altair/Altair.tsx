/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";
import { isFunctionDeclarationsTool } from "../../utils/isFunctionDeclarationsTool";

const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      json_graph: {
        type: Type.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    setConfig((config: LiveConnectConfig) => {
      const tools = [...(config.tools ?? [])]
        .filter(isFunctionDeclarationsTool)
        .filter(Boolean)
        .map((tool) => tool.functionDeclarations ?? [])
        .flat();
      // console.log("[App] configured tool names: ", tools);

      const uniqueTools = [
        ...new Map(
          [...tools, ...[declaration]].map((tool) => [tool.name, tool])
        ).values(),
      ];
      // console.log("unique tools", uniqueTools);

      const configuredInstructions = config.systemInstruction?.parts ?? [];
      const componentInstructions: Part[] = [
        {
          text: 'You are my helpful assistant. Any time I ask you for a graph call the "render_altair" function I have provided you. Dont ask for additional information just make your best judgement.',
        },
      ];

      const uniqueSystemInstructions = [
        ...new Map(
          [...configuredInstructions, ...componentInstructions].map((tool) => [
            tool.text,
            tool,
          ])
        ).values(),
      ];

      console.log(`[AltairComponent] init`, config.systemInstruction);

      return {
        ...config,
        systemInstruction: {
          parts: [...uniqueSystemInstructions],
        },
        tools: [{ functionDeclarations: uniqueTools }],
        // tools: [
        //   // there is a free-tier quota for search
        //   { googleSearch: {} },
        //   { functionDeclarations: [declaration] },
        // ],
      };
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        console.log(`[AltairComponent] got toolcall`, toolCall);
        const str = (fc.args as any).json_graph;
        setJSONString(str);

        // send data for the response of your tool call
        // in this case Im just saying it was successful
        if (toolCall.functionCalls.length) {
          setTimeout(() => {
            console.log(`[AltairComponent] send tool response`);
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { success: true } },
                id: fc.id,
                name: fc.name,
              })),
            }),
          200
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      console.log("jsonString", jsonString);
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);
  return (
    <>
      <div className="vega-embed" ref={embedRef} />
      {jsonString && "Hello Youssef"}
    </>
  );
}

export const Altair = memo(AltairComponent);
