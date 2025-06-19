import { Usecase } from "./Usecase";
import { Tool, ToolsGateway } from "@core/domain";

type GetApplicationToolsInputPort = {
  appName: string;
};

type GetApplicationToolsOutputPort = {};

export class GetApplicationTools
  implements
    Usecase<
      GetApplicationToolsInputPort,
      GetApplicationToolsOutputPort,
      Tool[]
    >
{
  constructor(private readonly toolsGateway: ToolsGateway) {}

  async execute(
    inputs: GetApplicationToolsInputPort,
    outputs?: GetApplicationToolsOutputPort
  ): Promise<Tool[]> {
    return await this.toolsGateway.getApplicationTools(inputs.appName);
  }
}
