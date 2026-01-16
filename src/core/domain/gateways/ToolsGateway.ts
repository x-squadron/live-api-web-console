import { Tool } from "@core/domain";

export interface ToolsGateway {
  getApplicationTools: (appName: string) => Promise<Tool[]>;
}
