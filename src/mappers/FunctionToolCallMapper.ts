import OpenAI from "openai";
import { LiveFunctionCall } from "../multimodal-live-types";

export class FunctionToolCallMapper {
  static fromLiveFunctionCall(
    toolCall: LiveFunctionCall
  ): OpenAI.ChatCompletionMessageToolCall {
    return {
      id: toolCall.id,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.args),
      },
    };
  }
}
