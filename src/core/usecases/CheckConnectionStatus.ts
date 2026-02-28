import {
  ApplicationConnection,
  ApplicationsConnectionsGateway,
} from "@core/domain";
import { Usecase } from "./Usecase";

type CheckConnectionStatusInputPort = {};

type CheckConnectionStatusOutputPort = {};

export class CheckConnectionStatus
  implements
    Usecase<
      CheckConnectionStatusInputPort,
      CheckConnectionStatusOutputPort,
      ApplicationConnection[]
    >
{
  constructor(private readonly appsGateway: ApplicationsConnectionsGateway) {}

  async execute(
    inputs: CheckConnectionStatusInputPort,
    outputs?: CheckConnectionStatusOutputPort
  ): Promise<ApplicationConnection[]> {
    return await this.appsGateway.checkConnectionStatus();
  }
}
