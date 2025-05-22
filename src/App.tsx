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

import { useEffect, useRef, useState } from "react";
import "./App.scss";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { GenList } from "./components/genlist/GenList";
import { isFunctionDeclarationsTool } from "./utils/isFunctionDeclarationsTool";
import { OpenAIToolSet } from "composio-core";
import { FunctionToolCallMapper } from "./mappers/FunctionToolCallMapper";
import { getDefaultTools } from "./tool-calling/ToolsCalling";
import { MCP_ACTIONS } from "./tool-calling/mcp-actions";
import {
  FunctionResponse,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerToolCall,
  Modality,
} from "@google/genai";
import { Alert } from "./components/alerts/Alert";
import { ToastContainer, toast } from "react-tiny-toast";

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    console.log("[App] init");

    const composioApiKey = process.env.REACT_APP_COMPOSIO_API_KEY;
    const composioToolset = new OpenAIToolSet({
      apiKey: composioApiKey,
    });

    // setModel("models/gemini-2.0-flash-exp");
    // model: "models/gemini-2.5-flash-exp",
    setModel("models/gemini-2.5-flash-preview-native-audio-dialog");

    (async () => {
      console.log("[App] fetching composio tools");

      const defaultTools = await getDefaultTools(composioToolset, [
        "GOOGLECALENDAR_CREATE_EVENT",
        "GOOGLECALENDAR_DELETE_EVENT",
        "GOOGLECALENDAR_FIND_EVENT",
        "GOOGLECALENDAR_FIND_FREE_SLOTS",
        "CALENDLY_GET_CURRENT_USER",
      ]);
      setConfig((config: LiveConnectConfig) => {
        const tools = [...(config.tools ?? [])]
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log("[App] configured tool names: ", tools);

        const defaultToolDeclarations = defaultTools
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log("[App] composio tool names: ", defaultToolDeclarations);

        const uniqueTools = [
          ...new Map(
            [...tools, ...defaultToolDeclarations].map((tool) => [
              tool.name,
              tool,
            ])
          ).values(),
        ];
        // console.log("unique tools", uniqueTools);

        return {
          ...config,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction: {
            parts: [
              // @ts-ignore
              ...(config.systemInstruction?.parts ?? []),
              {
                text: `You are a helpfull assistant that can access and manage my calendar, please always use one of these tools when asked about anything related to my events, never invent events.
                       • "GOOGLECALENDAR_CREATE_EVENT"
                       • "GOOGLECALENDAR_DELETE_EVENT"
                       • "GOOGLECALENDAR_FIND_EVENT"
                       • "GOOGLECALENDAR_FIND_FREE_SLOTS"
                       • "CALENDLY_GET_CURRENT_USER"
                `,
              },
            ],
          },
          tools: [{ functionDeclarations: uniqueTools }],
        };
      });
    })();

    const onToolCall = async (toolCall: LiveServerToolCall) => {
      const fCalls = toolCall.functionCalls;
      const functionResponses: FunctionResponse[] = [];

      if (fCalls && fCalls.length > 0) {
        for (const fCall of fCalls) {
          let functionResponse: FunctionResponse = {
            id: fCall.id,
            name: fCall.name,
            response: {
              result: { string_value: `${fCall.name} OK.` },
              data: "",
            },
          };
          let handled = true;

          switch (fCall.name as MCP_ACTIONS) {
            case "GOOGLECALENDAR_FIND_EVENT":
            case "GOOGLECALENDAR_FIND_FREE_SLOTS":
            case "GOOGLECALENDAR_CREATE_EVENT":
            case "GOOGLECALENDAR_DELETE_EVENT":
            case "CALENDLY_GET_CURRENT_USER": {
              try {
                const response = await composioToolset.executeToolCall(
                  FunctionToolCallMapper.fromLiveFunctionCall(fCall)
                );
                functionResponse.response!.data = JSON.parse(response);
              } catch (error) {
                functionResponse.response!.data = {
                  error: error instanceof Error ? error.message : String(error),
                };
              }
              break;
            }
            default:
              handled = false;
              break;
          }

          if (handled && functionResponse) {
            console.log(`[App] got toolcall`, toolCall, functionResponse);
            functionResponses.push(functionResponse);

            // Show alert based on response
            const resp = functionResponse.response?.data;
            const isSuccess = !(resp as any)?.error;

            if (isSuccess) {
              toast.show(
                <Alert type="success">
                  {`Tool call '${fCall.name}' was executed successfully ✅`}
                </Alert>,
                {
                  timeout: 3000,
                }
              );
            } else {
              console.log("❌ [App] tool call failed", resp);
              toast.show(
                <Alert type="error">
                  {`Tool call '${fCall.name}' failed ❌`}
                </Alert>,
                {
                  timeout: 3000,
                }
              );
            }
          }
        }

        console.log(`[App] functionResponses:`, functionResponses);
        if (functionResponses.length) {
          // Send tool responses back to the model
          const toolResponse: LiveClientToolResponse = {
            functionResponses: functionResponses,
          };
          console.log(`[App] send tool response`, toolResponse);
          client.sendToolResponse(toolResponse);
        }
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [setConfig, setModel, client]);

  return (
    <div className="App">
      <ToastContainer />
      <div className="streaming-console">
        <SidePanel />
        <main>
          <div className="main-app-area">
            {/* APP goes here */}
            <Altair />
            <GenList />
            <video
              className={cn("stream", {
                hidden: !videoRef.current || !videoStream,
              })}
              ref={videoRef}
              autoPlay
              playsInline
            />
          </div>

          <ControlTray
            videoRef={videoRef}
            supportsVideo={true}
            onVideoStreamChange={setVideoStream}
            enableEditingSettings={true}
          >
            {/* put your own buttons here */}
          </ControlTray>
        </main>
      </div>
    </div>
  );
}

export default App;
