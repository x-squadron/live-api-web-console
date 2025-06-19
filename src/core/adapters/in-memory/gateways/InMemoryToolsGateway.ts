import { Tool, ToolsGateway } from "@core/domain";

export class InMemoryToolsGateway implements ToolsGateway {
  constructor(private readonly tools: Tool[] = []) {}

  getApplicationTools = async (appName: string): Promise<Tool[]> => {
    return this.tools.filter((tool) => tool.appName === appName);
  };
}
