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
  const { getAllSelectedToolNames, getActiveSelectedToolNames, selectedTools, activationStatuses } = useSelectedToolsContext();

  // Initialize composio toolset and model (runs once)
  useEffect(() => {
    console.log("[App] init");
    setModel("models/gemini-2.5-flash-preview-native-audio-dialog");
  }, [setModel]);

  // Update tools configuration whenever selectedTools changes
  useEffect(() => {
    const updateToolsConfig = async () => {
      console.log("[App] updating tools configuration");
      console.log("[App] selectedTools state:", selectedTools);

      const composioApiKey = process.env.REACT_APP_COMPOSIO_API_KEY!;

      if (!composioApiKey) {
        console.error("REACT_APP_COMPOSIO_API_KEY is not set");
        return;
      }

      const composioToolset = new OpenAIToolSet({
        apiKey: composioApiKey,
      });

      // Get selected tools from context (only from activated apps)
      const selectedToolNames = getActiveSelectedToolNames();
      console.log("[App] Active selected tools from context:", selectedToolNames);

      // Only load tools that are actually selected from the UI
      let composioTools: Tool[] = [];
      if (selectedToolNames.length > 0) {
        composioTools = await getDefaultTools(composioToolset, selectedToolNames);
      }

      setConfig((config: LiveConnectConfig) => {
        // Get existing tools from config
        const existingTools = [...(config.tools ?? [])]
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log("[App] existing tool names: ", existingTools.map(t => t.name));

        // Get composio tool declarations
        const composioToolDeclarations = composioTools
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log("[App] composio tool names: ", composioToolDeclarations.map(t => t.name));

        // Define known built-in tool names that should always be preserved
        const builtInToolNames = [
          'look_at_lists',
          'edit_list', 
          'remove_list',
          'create_list',
          'render_altair'
        ];

        // Filter existing tools to only include built-in tools (not composio tools)
        const builtInTools = existingTools.filter(tool => 
          builtInToolNames.includes(tool.name || '')
        );

        console.log("[App] built-in tools preserved: ", builtInTools.map(t => t.name));

        // Combine built-in tools with currently selected composio tools
        const allTools = [...builtInTools, ...composioToolDeclarations];
        
        // Remove duplicates by name
        const uniqueTools = [
          ...new Map(
            allTools.map((tool) => [tool.name, tool])
          ).values(),
        ];

        console.log("[App] final unique tools:", uniqueTools.map(t => t.name));

        // Create dynamic system instruction based on selected tools
        const toolsList =
          selectedToolNames.length > 0
            ? selectedToolNames
                .map((tool) => `• "${tool}"`)
                .join("\n                       ")
            : "";

        const systemInstructionText =
          `EN: You are a helpful assistant that can access and manage various tools and services. Please always use one of these available tools when asked about anything related to their functionality, never invent data.
                       ${toolsList}
                       FR: Tu es un assistant utile qui peut accéder à divers outils et services. Utilise toujours l'un des outils disponibles suivants lorsqu'on te pose une question liée à leur fonctionnalité, et ne crée jamais de données inventées.
                       ${toolsList}
                       AR: أنت مساعد ذكي يمكنه الوصول إلى أدوات وخدمات مختلفة. يُرجى استخدام أحد هذه الأدوات المتاحة دائمًا عند سؤالك عن أي شيء متعلق بوظائفها، ولا تخترع بيانات من نفسك.
                       ${toolsList}`;

        // Get base system instruction parts (excluding our dynamic tool instruction)
        const baseInstructionParts = (() => {
          if (!config.systemInstruction) return [];
          if (typeof config.systemInstruction === "string") return [];
          if (Array.isArray(config.systemInstruction)) return [];
          if ("parts" in config.systemInstruction && Array.isArray(config.systemInstruction.parts)) {
            return config.systemInstruction.parts.filter((part: any) => 
              !part.text?.includes("You are a helpful assistant that can access and manage various tools")
            );
          }
          return [];
        })();

        return {
          ...config,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction: {
            parts: [
              ...baseInstructionParts,
              {
                text: systemInstructionText,
              },
            ],
          },
          tools: [{ functionDeclarations: uniqueTools }],
        };
      });
    };

    updateToolsConfig();
  }, [selectedTools, activationStatuses, getActiveSelectedToolNames, setConfig]);

  // Set up tool call handler (runs once)
  useEffect(() => {
    const composioApiKey = process.env.REACT_APP_COMPOSIO_API_KEY!;
    
    if (!composioApiKey) {
      console.error("REACT_APP_COMPOSIO_API_KEY is not set");
      return;
    }

    const composioToolset = new OpenAIToolSet({
      apiKey: composioApiKey,
    });

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

          // Get currently active selected tools (only from activated apps)
          const activeSelectedToolNames = getActiveSelectedToolNames();

          // Check if this tool is in our active selected tools
          const isSelectedTool =
            fCall.name && activeSelectedToolNames.includes(fCall.name);

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
            // Tool not selected - check if it's a built-in tool (GenList, Altair, etc.)
            // Let other components handle their own tools
            handled = false;
            console.log(`[App] Tool '${fCall.name}' not in selected composio tools, letting other handlers process it`);
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
  }, [client, getActiveSelectedToolNames]);

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
