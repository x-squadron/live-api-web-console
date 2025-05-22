import {
  ChangeEvent,
  FormEventHandler,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import "./settings-dialog.scss";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { LiveConfig } from "../../multimodal-live-types";
import {
  FunctionDeclaration,
  FunctionDeclarationsTool,
  SchemaType,
  Tool,
} from "@google/generative-ai";
import VoiceSelector from "./VoiceSelector";
import ResponseModalitySelector from "./ResponseModalitySelector";
import { MCPServerSelector } from "./MCPServerSelector";
import { MCPToolsList } from "./MCPToolsList";
import { useMCPToolsStore } from "../../lib/stores/mcpToolsStore";
import { MCPTool } from "../../lib/composioClient";

const ORIGINAL_SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: `In this conversation you will help the user with making a checklist or multiple checklists. Use the tools provided to fulfil requests to help create and modify lists. Always call any relevant tools *before* speaking. \n\n# Checklist guidance:\n- Give each list an appropriate title with emoji (eg. "🎬 My Favorite Movies")\n- Give each list an id for identification (eg. "favorite-movies")\n- Give list items as an array of markdown-formatted strings\n- Use extended markdown for checkboxes: "- [ ] unchecked item" and "- [x] checked item"\n- Help me by checking off items when requested\n- Add headings eg. "## Heading" when requested to sort/organise/structure lists\n- Bias towards creating new lists for new topics\n- If I don't specify what to put on the list, let me know you've added some examples\n- Use existing examples, if any, as a reference for your new list\n- Do not return the list in your conversational response, only via tools\n- There is no need to ask if there is anything else you can help with\n- Combine lists by removing relevant existing lists and creating a new one when requested\n- Note that the user can also check off and reorder items using the UI\n\nThe user will now start the conversation, probably by asking you to "start a list about: {my request}". Create the checklist for the user, then you two can co-create checklists together. Speak as helpfully and concisely as possible. Always call any relevant tools *before* speaking.`
    }
  ]
};

// Helper to get built-in list tools from config
function getListFunctionDeclarations(config: any) {
  return ((config.tools || []) as Tool[])
    .filter((t: Tool): t is FunctionDeclarationsTool =>
      Array.isArray((t as any).functionDeclarations)
    )
    .map((t) => t.functionDeclarations)
    .filter((fc) => !!fc)
    .flat();
}

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { config, setConfig, connected } = useLiveAPIContext();
  const { tools: mcpTools } = useMCPToolsStore();

  // Combine built-in list tools and MCP tools for display
  const functionDeclarations: FunctionDeclaration[] = useMemo(() => {
    const listTools = getListFunctionDeclarations(config);
    const mcpFunctionDeclarations: FunctionDeclaration[] = mcpTools.map((tool: MCPTool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
    return [...listTools, ...mcpFunctionDeclarations];
  }, [config, mcpTools]);

  const systemInstruction = useMemo(() => {
    const s = config.systemInstruction?.parts.find((p) => p.text)?.text || ORIGINAL_SYSTEM_INSTRUCTION.parts[0].text;
    return s;
  }, [config]);

  const updateConfig: FormEventHandler<HTMLTextAreaElement> = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newConfig: LiveConfig = {
        ...config,
        systemInstruction: {
          parts: [{ text: event.target.value }],
        },
      };
      setConfig(newConfig);
    },
    [config, setConfig]
  );

  const updateFunctionDescription = useCallback(
    (editedFdName: string, newDescription: string) => {
      // Get existing tools from config
      const existingTools = config.tools || [];
      
      // Find the function declarations tool
      const functionDeclarationsTool = existingTools.find(
        (t): t is FunctionDeclarationsTool => 
          'functionDeclarations' in t && Array.isArray((t as any).functionDeclarations)
      );

      // Get existing function declarations
      const existingDeclarations = functionDeclarationsTool?.functionDeclarations || [];
      
      // Update the description
      const updatedDeclarations = existingDeclarations.map((fd) =>
        fd.name === editedFdName ? { ...fd, description: newDescription } : fd
      );

      // Add MCP tools to function declarations
      const mcpDeclarations = mcpTools.map((tool: MCPTool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      }));

      // Combine all declarations
      const allDeclarations = [...updatedDeclarations, ...mcpDeclarations];

      // Update config with combined tools
      setConfig({
        ...config,
        tools: [
          { functionDeclarations: allDeclarations } as FunctionDeclarationsTool,
          ...existingTools.filter(t => !('functionDeclarations' in t)) // Keep other tools (googleSearch, codeExecution)
        ],
        systemInstruction: config.systemInstruction || ORIGINAL_SYSTEM_INSTRUCTION
      });
    },
    [config, setConfig, mcpTools]
  );

  return (
    <div className="settings-dialog">
      <button
        className="action-button material-symbols-outlined"
        onClick={() => setOpen(!open)}
      >
        settings
      </button>
      <dialog className="dialog" style={{ display: open ? "block" : "none" }}>
        <div className={`dialog-container ${connected ? "disabled" : ""}`}>
          {connected && (
            <div className="connected-indicator">
              <p>
                These settings can only be applied before connecting and will
                override other settings.
              </p>
            </div>
          )}
          <div className="mode-selectors">
            <ResponseModalitySelector />
            <VoiceSelector />
          </div>

          <MCPServerSelector />
          <MCPToolsList />

          <h3>System Instructions</h3>
          <textarea
            className="system"
            onChange={updateConfig}
            value={systemInstruction}
          />
          <h4>Function declarations</h4>
          <div className="function-declarations">
            <div className="fd-rows">
              {functionDeclarations.map((fd, fdKey) => (
                <div className="fd-row" key={`function-${fdKey}`}>
                  <span className="fd-row-name">{fd.name}</span>
                  <span className="fd-row-args">
                    {Object.keys(fd.parameters?.properties || {}).map(
                      (item, k) => (
                        <span key={k}>{item}</span>
                      )
                    )}
                  </span>
                  <input
                    key={`fd-${fd.description}`}
                    className="fd-row-description"
                    type="text"
                    defaultValue={fd.description}
                    onBlur={(e) =>
                      updateFunctionDescription(fd.name, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
