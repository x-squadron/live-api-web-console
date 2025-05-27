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

// App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.scss";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";
import { useSelectedToolsContext } from "./contexts/SelectedToolsContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { GenList } from "./components/genlist/GenList";
import { isFunctionDeclarationsTool } from "./utils/isFunctionDeclarationsTool";
import { OpenAIToolSet, Composio } from "composio-core";
import { FunctionToolCallMapper } from "./mappers/FunctionToolCallMapper";
import { getDefaultTools } from "./tool-calling/ToolsCalling";
import {
  FunctionResponse,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerToolCall,
  Modality,
  Tool,
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
  const { getAllSelectedToolNames } = useSelectedToolsContext();

  useEffect(() => {
    console.log("[App] init");

    const composioApiKey = process.env.REACT_APP_COMPOSIO_API_KEY!;

    if (!composioApiKey) {
      console.error("REACT_APP_COMPOSIO_API_KEY is not set");
      return;
    }

    const composioToolset = new OpenAIToolSet({
      apiKey: composioApiKey,
    });
    const composio = new Composio({
      apiKey: composioApiKey,
    });
    // setModel("models/gemini-2.0-flash-exp");
    // model: "models/gemini-2.5-flash-exp",
    setModel("models/gemini-2.5-flash-preview-native-audio-dialog");

    (async () => {
      console.log("[App] fetching composio tools");
      const apps = await composio.apps.list();
      console.log("[Composio] fetching composio available apps:", apps);

      // Get selected tools from context instead of hardcoded list
      const selectedToolNames = getAllSelectedToolNames();
      console.log("[App] Selected tools from context:", selectedToolNames);

      // Only load tools that are actually selected from the UI
      const toolsToLoad = selectedToolNames;

      let defaultTools: Tool[] = [];
      if (toolsToLoad.length > 0) {
        defaultTools = await getDefaultTools(composioToolset, toolsToLoad);
      }

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

        // Create dynamic system instruction based on selected tools
        const toolsList =
          toolsToLoad.length > 0
            ? toolsToLoad
                .map((tool) => `• "${tool}"`)
                .join("\n                       ")
            : "";

        const systemInstructionText =
          // toolsToLoad.length > 0 ?
          `EN: You are a helpful assistant that can access and manage various tools and services. Please always use one of these available tools when asked about anything related to their functionality, never invent data.
                       ${toolsList}
                       FR: Tu es un assistant utile qui peut accéder à divers outils et services. Utilise toujours l'un des outils disponibles suivants lorsqu'on te pose une question liée à leur fonctionnalité, et ne crée jamais de données inventées.
                       ${toolsList}
                       AR: أنت مساعد ذكي يمكنه الوصول إلى أدوات وخدمات مختلفة. يُرجى استخدام أحد هذه الأدوات المتاحة دائمًا عند سؤالك عن أي شيء متعلق بوظائفها، ولا تخترع بيانات من نفسك.
                       ${toolsList}`;
        // : `EN: You are a helpful assistant. Currently no external tools are selected, so please provide general assistance based on your knowledge.
        //            FR: Tu es un assistant utile. Actuellement, aucun outil externe n'est sélectionné, alors fournis une assistance générale basée sur tes connaissances.
        //            AR: أنت مساعد ذكي. حاليًا لم يتم تحديد أي أدوات خارجية، لذا يُرجى تقديم المساعدة العامة بناءً على معرفتك.`;

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
                text: systemInstructionText,
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

          // Get currently selected tools
          const selectedToolNames = getAllSelectedToolNames();

          // Check if this tool is in our selected tools
          const isSelectedTool =
            fCall.name && selectedToolNames.includes(fCall.name);

          if (isSelectedTool) {
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
          } else {
            // Tool not selected
            handled = false;
            console.log(`[App] Tool '${fCall.name}' not in selected tools`);
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
  }, [setConfig, setModel, client, getAllSelectedToolNames]);

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
