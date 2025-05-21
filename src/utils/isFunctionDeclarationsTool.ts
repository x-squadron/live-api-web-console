import { FunctionDeclarationsTool, Tool } from "@google/generative-ai";

export function isFunctionDeclarationsTool(
  tool: Tool | { googleSearch: {} } | { codeExecution: {} }
): tool is FunctionDeclarationsTool {
  return (tool as FunctionDeclarationsTool).functionDeclarations !== undefined;
}
