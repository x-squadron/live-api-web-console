import { Application, ApplicationsGateway } from "@core/domain";

export class InMemoryApplicationsGateway implements ApplicationsGateway {
  constructor(private readonly apps: Application[] = []) {}

  getAvailableApplications = async (): Promise<Application[]> => {
    return this.apps;
  };
}
