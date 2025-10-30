/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// App.tsx
import { useEffect, useRef, useState } from "react";
import cn from "classnames";
import "./App.scss";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";
import { useSelectedToolsContext } from "./contexts/SelectedToolsContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import { ProactiveAudio } from "./components/proactive-audio/ProactiveAudio"
import { GenList } from "./components/genlist/GenList";
import { isFunctionDeclarationsTool } from "./utils/isFunctionDeclarationsTool";
import { OpenAIToolSet } from "composio-core";
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
import { COMPOSIO_ENTITY_ID } from "./components/composio-button/composioAppList";

const isDebugMode = process.env.REACT_APP_DEBUG_MODE === "true"
console.log("env : ", process.env, {isDebugMode})

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const { client, setConfig, setModel } = useLiveAPIContext();
  const {
    getActiveSelectedToolNames,
    getActiveSelectedToolsWithDescriptions,
    selectedTools,
    activationStatuses,
  } = useSelectedToolsContext();

  // Initialize composio toolset and model (runs once)
  useEffect(() => {
    console.log("[App] init");
    setModel("models/gemini-2.5-flash-native-audio-preview-09-2025");
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
      console.log(
        "[App] Active selected tools from context:",
        selectedToolNames
      );

      // Only load tools that are actually selected from the UI
      let composioTools: Tool[] = [];
      if (selectedToolNames.length > 0) {
        composioTools = await getDefaultTools(
          composioToolset,
          selectedToolNames
        );
      }

      setConfig((config: LiveConnectConfig) => {
        // Get existing tools from config
        const existingTools = [...(config.tools ?? [])]
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log(
          "[App] existing tool names: ",
          existingTools.map((t) => t.name)
        );

        // Get composio tool declarations
        const composioToolDeclarations = composioTools
          .filter(isFunctionDeclarationsTool)
          .filter(Boolean)
          .map((tool) => tool.functionDeclarations ?? [])
          .flat();

        console.log(
          "[App] composio tool names: ",
          composioToolDeclarations.map((t) => t.name)
        );

        // // Combine built-in tools with currently selected composio tools
        const allTools = [...existingTools, ...composioToolDeclarations];

        // Remove duplicates by name
        const uniqueTools = [
          ...new Map(allTools.map((tool) => [tool.name, tool])).values(),
        ];

        console.log(
          "[App] final unique tools:",
          uniqueTools.map((t) => t.name)
        );

        // Create dynamic system instruction based on selected tools with descriptions
        const activeToolsWithDescriptions =
          getActiveSelectedToolsWithDescriptions();
        const allToolsWithDescriptions = [
          // ...builtInToolsWithDescriptions,
          ...activeToolsWithDescriptions,
        ];

        const toolsList =
          allToolsWithDescriptions.length > 0
            ? allToolsWithDescriptions
                .map((tool) => `• "${tool.name}": ${tool.description}`)
                .join("\n                       ")
            : "";

        const systemInstructionText =
          allTools.length > 0
            ? `You are a helpful AI assistant with access to multiple specialized tools and services. Your primary goal is to help users accomplish their tasks efficiently by using the appropriate tools.

${isDebugMode ? `
## IMPORTANT: Planning and Approval Workflow
**BEFORE calling any tools, you MUST:**
1. **Analyze** the user's request and determine what tools you need to use
2. **Present a clear plan** explaining:
   - What you understand from their request
   - Which tools you plan to use and why
   - The sequence of actions you'll take
   - What the expected outcome will be
3. **Ask for approval** with phrases like:
   - "Does this plan look good to you?"
   - "Should I proceed with this approach?"
   - "Would you like me to adjust anything before I start?"
4. **Wait for user confirmation** before calling any tools
5. **Only after approval**, proceed with tool execution
`:''}

## Core Principles:
- Always use available tools when they can help accomplish the user's request
- You can call multiple tools in sequence or parallel when needed
- Provide clear explanations of what you're doing and why
- Never invent data - only use real information from tool responses

## Available Tools:

${toolsList?.length > 0 ? `
### Built-in Capabilities:
${toolsList}
`:''}

## Multi-Tool Coordination:
- When a task requires multiple steps, call tools in logical sequence
- For complex requests, break them down and use multiple tools as needed
- Always wait for tool responses before proceeding to next steps
- Combine results from different tools to provide comprehensive answers

## Specific Guidance:
- **For data visualization**: Use render_altair for any graph, chart, or data visualization requests
- **For list management**: Use the list tools (create_list, edit_list, etc.) for checklists, todo items, or organized information
  - Give each list an appropriate title with emoji (eg. "🎬 My Favorite Movies")
  - Give each list an id for identification (eg. "favorite-movies")
  - Give list items as an array of markdown-formatted strings
  - Use extended markdown for checkboxes: "- [ ] unchecked item" and "- [x] checked item"
  - Help users by checking off items when requested
  - Add headings eg. "## Heading" when requested to sort/organise/structure lists
  - Bias towards creating new lists for new topics
  - If user doesn't specify what to put on the list, let them know you've added some examples
  - Use existing examples, if any, as a reference for new lists
  - Do not return the list in your conversational response, only via tools
  - Combine lists by removing relevant existing lists and creating a new one when requested
  - Note that users can also check off and reorder items using the UI
- **For external services**: Use the appropriate external tools for their specific functionalities
- **For complex tasks**: Don't hesitate to use multiple tools to accomplish the user's goal

## Response Style:
- Be concise but helpful
- Explain your tool usage when it adds value
- Focus on accomplishing the user's actual goal
${isDebugMode ? `
- **REMEMBER: Always present your plan and get approval BEFORE calling tools**
`:''}
- Always respond in the same language as the user's request (English, French, Arabic, etc.)

${isDebugMode ? `
## Example Workflow:
User: "Create a chart showing sales data"
You: "I understand you want a sales data visualization. Here's my plan:
1. I'll use the render_altair tool to create an interactive chart
2. I'll include sample sales data with months and revenue figures
3. The chart will be a bar chart showing monthly sales trends

Does this plan look good to you? Should I proceed with creating this visualization?"
[Wait for user approval]
User: "Yes, go ahead"
[Then call the render_altair tool]
`:''}
`
            : `You are a helpful AI assistant. Currently no external tools are selected, so please provide general assistance based on your knowledge and reasoning capabilities.`;

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
          tools: [{ functionDeclarations: uniqueTools }, { googleSearch: {} }],
        };
      });
    };

    updateToolsConfig();
  }, [
    selectedTools,
    activationStatuses,
    getActiveSelectedToolNames,
    getActiveSelectedToolsWithDescriptions,
    setConfig,
  ]);

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
                FunctionToolCallMapper.fromLiveFunctionCall(fCall),
                COMPOSIO_ENTITY_ID
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
            console.log(
              `[App] Tool '${fCall.name}' not in selected composio tools, letting other handlers process it`
            );
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
            <ProactiveAudio />
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
