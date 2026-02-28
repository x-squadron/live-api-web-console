import { Tool, ToolUnion } from "@google/genai";

export function isFunctionDeclarationsTool(
  tool: ToolUnion,
  index: number,
  array: ToolUnion[]
): tool is Tool {
  return (tool as Tool).functionDeclarations !== undefined;
}
