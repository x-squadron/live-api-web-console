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
import { getDefaultTools } from "./ToolsCalling";
import { LiveConfig } from "./multimodal-live-types";
import { isFunctionDeclarationsTool } from "./utils/isFunctionDeclarationsTool";

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const { setConfig } = useLiveAPIContext();

  useEffect(() => {
    console.log("[App] init");

    (async () => {
      console.log("[App] fetching composio tools");
      const defaultTools = await getDefaultTools();
      setConfig((config: LiveConfig) => {
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
          model: "models/gemini-2.0-flash-exp",
          generationConfig: {
            responseModalities: "audio", // switch to "audio" for audio out
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
          },
          systemInstruction: {
            parts: [...(config.systemInstruction?.parts ?? [])],
          },
          tools: [{ functionDeclarations: uniqueTools }],
        };
      });
    })();
  }, [setConfig]);

  return (
    <div className="App">
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
