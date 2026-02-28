import {
  ApplicationConnection,
  ApplicationsConnectionsGateway,
} from "@core/domain";

export class InMemoryApplicationsConnectionsGateway
  implements ApplicationsConnectionsGateway
{
  constructor(private readonly connections: ApplicationConnection[] = []) {}

  checkConnectionStatus = async (): Promise<ApplicationConnection[]> => {
    return this.connections;
  };
}
