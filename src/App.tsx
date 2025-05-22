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

import { useRef, useState, useEffect } from "react";
import "./App.scss";
import { LiveAPIProvider, useLiveAPIContext } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import { GenList } from "./components/genlist/GenList";
import { ToolCall } from "./multimodal-live-types";
import { composioService } from "./lib/composioClient";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

function AppContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const { client } = useLiveAPIContext();

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      const functionResponses = [];
      
      for (const fCall of toolCall.functionCalls) {
        try {
          // Check if this is a built-in tool (list tools)
          if (['look_at_lists', 'edit_list', 'remove_list', 'create_list'].includes(fCall.name)) {
            // Skip built-in tools as they are handled by their respective components
            continue;
          }
          
          // Execute MCP tools using Composio service
          const result = await composioService.executeTool(fCall.name, fCall.args);
          
          functionResponses.push({
            id: fCall.id,
            name: fCall.name,
            response: {
              result: { string_value: JSON.stringify(result) }
            }
          });
        } catch (error: any) {
          console.error(`Error executing tool ${fCall.name}:`, error);
          functionResponses.push({
            id: fCall.id,
            name: fCall.name,
            response: {
              result: { string_value: `Error executing tool: ${error?.message || 'Unknown error'}` }
            }
          });
        }
      }

      // Only send tool responses if we have any
      if (functionResponses.length > 0) {
        client.sendToolResponse({
          functionResponses
        });
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  return (
    <div className="streaming-console">
      <SidePanel />
      <main>
        <div className="main-app-area">
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
  );
}

function App() {
  return (
    <div className="App">
      <LiveAPIProvider url={uri} apiKey={API_KEY}>
        <AppContent />
      </LiveAPIProvider>
    </div>
  );
}

export default App;
