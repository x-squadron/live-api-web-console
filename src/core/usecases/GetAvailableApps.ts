import { Application } from "@core";
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
  execute(
    inputs: GetAvailableAppsInputPort,
    outputs?: GetAvailableAppsOutputPort
  ): Promise<Application[]> {
    throw new Error("Method not implemented.");
  }
}
