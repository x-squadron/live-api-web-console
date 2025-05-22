import { Tool } from "@google/genai";

export function isFunctionDeclarationsTool(tool: Tool): boolean {
  return tool.functionDeclarations !== undefined;
}
