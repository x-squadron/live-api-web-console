import { FunctionCall } from "@google/genai";
import OpenAI from "openai";

export class FunctionToolCallMapper {
  static fromLiveFunctionCall(
    toolCall: FunctionCall
  ): OpenAI.ChatCompletionMessageToolCall {
    return {
      id: toolCall.id ?? "XXX",
      type: "function",
      function: {
        name: toolCall.name ?? "UnnamedFunction",
        arguments: JSON.stringify(toolCall.args),
      },
    };
  }
}
