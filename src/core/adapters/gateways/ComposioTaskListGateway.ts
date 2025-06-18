import { TaskItem, TaskListGateway, TimeInterval } from "@core/domain";
import { TASK_TOOL_REGISTRY } from "@core";
import { ComposioTaskMapper } from "../mappers/ComposioTaskMapper";
import { OpenAIToolSet } from "composio-core";
import { OpenAI } from "openai";

export class ComposioTaskListGateway implements TaskListGateway {
  private readonly toolset: OpenAIToolSet;
  private readonly mapper: ComposioTaskMapper;

  constructor(apiKey: string) {
    this.toolset = new OpenAIToolSet({ apiKey });
    this.mapper = new ComposioTaskMapper();
  }

  async generateTaskListForInterval(
    interval: TimeInterval
  ): Promise<TaskItem[]> {
    const tasks: TaskItem[] = [];

    for (const [toolKey, toolName] of Object.entries(TASK_TOOL_REGISTRY)) {
      if (!toolName) continue;

      const args = this.getArgumentsForTool(toolKey, interval);

      const toolCall: OpenAI.ChatCompletionMessageToolCall = {
        id: `toolcall-${Date.now()}`,
        type: "function",
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      };

      try {
        const response = await this.toolset.executeToolCall(toolCall);
        const parsed = JSON.parse(response);

        if (toolKey === "googlecalendar") {
          const events = parsed?.data?.event_data?.event_data ?? [];
          tasks.push(
            ...events.map((event: any) => this.mapper.fromGoogleCalendar(event))
          );
        }

        if (toolKey === "linear") {
          const issues = parsed?.data?.issues ?? [];
          tasks.push(
            ...issues.map((issue: any) => this.mapper.fromLinearIssue(issue))
          );
        }

        // ➕ Other apps will be added here as needed
      } catch (err) {
        console.warn(`❌ Failed to execute tool '${toolKey}':`, err);
        continue;
      }
    }

    return tasks;
  }

  private getArgumentsForTool(
    toolKey: string,
    interval: TimeInterval
  ): Record<string, string> {
    switch (toolKey) {
      case "googlecalendar":
        return {
          timeMin: interval.start.toISOString(),
          timeMax: interval.end.toISOString(),
        };
      case "linear":
        return { first: "20" };
      default:
        return {};
    }
  }
}
