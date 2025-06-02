import { Application, ApplicationsGateway } from "@core/domain";
import { Usecase } from "./Usecase";

type GetAvailableAppsInputPort = {};

type GetAvailableAppsOutputPort = {};

export class GetAvailableApps
  implements
    Usecase<
      GetAvailableAppsInputPort,
      GetAvailableAppsOutputPort,
      Application[]
    >
{
  constructor(private readonly appsGateway: ApplicationsGateway) {}

  async execute(
    inputs: GetAvailableAppsInputPort,
    outputs?: GetAvailableAppsOutputPort
  ): Promise<Application[]> {
    return await this.appsGateway.getAvailableApplications();
  }
}
