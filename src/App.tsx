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
import { OpenAIToolSet } from "composio-core";
import { FunctionToolCallMapper } from "./mappers/FunctionToolCallMapper";
import { getDefaultTools } from "./tool-calling/ToolsCalling";
import { handleA2AToolCall } from "./tool-calling/DynamicA2ATools";
import { CreateDynamicAgent } from "./core/usecases/CreateDynamicAgent";
import { DestroyDynamicAgent } from "./core/usecases/DestroyDynamicAgent";
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

        const currentDateTime = new Date().toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });

        const systemInstructionText =
          allTools.length > 0
            ? `You are a helpful AI assistant with access to multiple specialized tools and services. Your primary goal is to help users accomplish their tasks efficiently by using the appropriate tools.

**CURRENT DATE AND TIME**: ${currentDateTime}
Use this information to correctly interpret relative time references like "tomorrow", "next week", "yesterday", etc.

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

## Core Principles:
- Always use available tools when they can help accomplish the user's request
- You can call multiple tools in sequence or parallel when needed
- Provide clear explanations of what you're doing and why
- Never invent data - only use real information from tool responses

## Available Tools:

### Multi-Agent System:
${process.env.REACT_APP_A2A_ENABLED === 'true' ? `
- **discover_agents**: Find available specialized agents for specific apps/domains
- **delegate_to_agent**: Delegate complex tasks to specialized agents when appropriate

**CRITICAL DELEGATION INSTRUCTIONS:**
When users ask about app-specific tasks (Google Calendar, Gmail, Linear, Slack, etc.), you should:

1. **First discover available agents** using discover_agents tool
2. **If specialized agents are found**, delegate the task using delegate_to_agent with:
   - agentId: The exact agent ID from discover_agents response (format: "agent-{appname}" where appname is lowercase with spaces as hyphens)
   - message: A clear, specific task description for the specialized agent

**MULTI-AGENT COORDINATION RULES:**
- If a task requires multiple agents (e.g., "check my calendar and send an email"), you MUST:
  1. Discover all relevant agents first
  2. Delegate to ALL necessary agents
  3. **WAIT for ALL agent responses before providing your final answer**
  4. Combine all agent responses into a comprehensive final response
- Do NOT respond to the user until ALL delegated tasks are complete
- If any delegation fails, explain what succeeded and what failed

**Example delegation workflows:**

*Single agent task:*
- User: "Schedule a meeting tomorrow at 2 PM"
- You: Use discover_agents to find calendar agents
- You: Use delegate_to_agent with agentId="agent-googlecalendar" and message="Schedule a meeting tomorrow at 2 PM"
- You: Wait for response, then provide final answer

*Multi-agent task:*
- User: "Check my calendar for conflicts and email the team about the meeting"
- You: Use discover_agents to find available agents
- You: Use delegate_to_agent with agentId="agent-googlecalendar" and message="Check my calendar for conflicts tomorrow at 2 PM"
- You: Use delegate_to_agent with agentId="agent-gmail" and message="Send email to team about meeting tomorrow at 2 PM"
- You: **WAIT for BOTH responses**, then combine results: "I checked your calendar (result from calendar agent) and sent the email (result from email agent)"

**IMPORTANT**: 
- Specialized agents are autonomous React agents that can execute tools directly
- They don't need tool instructions - just clear task descriptions
- Agent IDs follow the pattern: agent-googlecalendar, agent-gmail, agent-linear, agent-slack, etc.
- Always use the exact agent ID returned by discover_agents
- **DO NOT generate or execute code under any circumstances** - you are only responsible for delegating tasks and providing text responses
- **NEVER use code execution tools** - if you feel the need to calculate something, delegate it to a specialized agent instead
- **STRICTLY TEXT RESPONSES ONLY** - do not attempt any code generation or execution
` : ''}

### Built-in Capabilities:
${toolsList}

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
- **REMEMBER: Always present your plan and get approval BEFORE calling tools**
- Always respond in the same language as the user's request (English, French, Arabic, etc.)

## Example Workflow:
User: "Create a chart showing sales data"
You: "I understand you want a sales data visualization. Here's my plan:
1. I'll use the render_altair tool to create an interactive chart
2. I'll include sample sales data with months and revenue figures
3. The chart will be a bar chart showing monthly sales trends

Does this plan look good to you? Should I proceed with creating this visualization?"
[Wait for user approval]
User: "Yes, go ahead"
[Then call the render_altair tool]`
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
          tools: [{ functionDeclarations: uniqueTools }],
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

  // Handle A2A agent lifecycle based on app activation/deactivation
  useEffect(() => {
    const isA2AEnabled = process.env.REACT_APP_A2A_ENABLED === 'true';

    if (!isA2AEnabled) {
      console.log('[App] A2A is disabled, skipping agent lifecycle management');
      return;
    }

    const handleAgentLifecycle = async () => {
      console.log('[App] Managing A2A agent lifecycle');
      
      const createAgentUsecase = new CreateDynamicAgent();
      const destroyAgentUsecase = new DestroyDynamicAgent();

      // Process each app's activation status
      for (const [appName, toolSet] of selectedTools.entries()) {
        const isAppActivated = activationStatuses.get(appName) !== false;
        const toolNames = Array.from(toolSet);

        if (isAppActivated && toolNames.length > 0) {
          // App is activated with tools - create agent if it doesn't exist
          try {
            console.log(`[App] Creating A2A agent for ${appName} with tools:`, toolNames);
            
            await createAgentUsecase.execute(
              {
                appName: appName,
                toolNames: toolNames
              },
              {
                onSuccess: (agentInfo) => {
                  console.log(`[App] Successfully created/found agent for ${appName}:`, agentInfo.id);
                  toast.show(
                    <Alert type="success">
                      {`🤖 ${appName} specialist agent activated`}
                    </Alert>,
                    { timeout: 3000 }
                  );
                },
                onError: (error) => {
                  console.error(`[App] Failed to create agent for ${appName}:`, error);
                  toast.show(
                    <Alert type="error">
                      {`Failed to activate ${appName} agent: ${error.message}`}
                    </Alert>,
                    { timeout: 5000 }
                  );
                }
              }
            );
          } catch (error) {
            console.error(`[App] Error in agent creation for ${appName}:`, error);
          }
        } else {
          // App is deactivated or has no tools - destroy agent if it exists
          try {
            console.log(`[App] Destroying A2A agent for ${appName}`);
            
            await destroyAgentUsecase.execute(
              {
                appName: appName
              },
              {
                onSuccess: (destroyedCount) => {
                  if (destroyedCount > 0) {
                    console.log(`[App] Successfully destroyed ${destroyedCount} agents for ${appName}`);
                    toast.show(
                      <Alert type="success">
                        {`🤖 ${appName} specialist agent deactivated`}
                      </Alert>,
                      { timeout: 3000 }
                    );
                  }
                },
                onError: (error) => {
                  console.error(`[App] Failed to destroy agents for ${appName}:`, error);
                }
              }
            );
          } catch (error) {
            console.error(`[App] Error in agent destruction for ${appName}:`, error);
          }
        }
      }
    };

    // Debounce the agent lifecycle management to avoid too frequent updates
    const timeoutId = setTimeout(handleAgentLifecycle, 1000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [selectedTools, activationStatuses]);

  // Set up tool call handler (runs once) - Host agent only handles A2A delegation
  useEffect(() => {
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

          if (fCall.name === "discover_agents" || fCall.name === "delegate_to_agent") {
            // Handle A2A delegation tools - the only tools the host agent executes
            try {
              console.log(`[App] Host agent handling A2A tool: ${fCall.name}`);
              const response = await handleA2AToolCall(fCall.name, fCall.args);
              functionResponse.response!.data = response;
              
              // Show success message for A2A delegation
              toast.show(
                <Alert type="success">
                  {fCall.name === "discover_agents" 
                    ? `🔍 Discovered ${response.agents?.length || 0} specialized agents`
                    : `🤖 Task delegated to specialized agent`
                  }
                </Alert>,
                { timeout: 3000 }
              );
              
            } catch (error) {
              console.error(`[App] A2A tool error:`, error);
              functionResponse.response!.data = {
                error: error instanceof Error ? error.message : String(error),
              };
              
              toast.show(
                <Alert type="error">
                  {`❌ A2A delegation failed: ${error instanceof Error ? error.message : 'Unknown error'}`}
                </Alert>,
                { timeout: 5000 }
              );
            }
          } else {
            // All other tools (including Composio tools) should be handled by specialized agents
            // Let other components handle built-in tools (GenList, Altair, etc.)
            handled = false;
            console.log(
              `[App] Tool '${fCall.name}' not handled by host agent - should be delegated to specialized agents or handled by built-in components`
            );
          }

          if (handled && functionResponse) {
            console.log(`[App] Host agent handled tool:`, fCall.name, functionResponse);
            functionResponses.push(functionResponse);
          }
        }

        console.log(`[App] Host agent functionResponses:`, functionResponses);
        if (functionResponses.length) {
          // Send tool responses back to the model
          const toolResponse: LiveClientToolResponse = {
            functionResponses: functionResponses,
          };
          console.log(`[App] Host agent sending tool response`, toolResponse);
          client.sendToolResponse(toolResponse);
        }
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

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
