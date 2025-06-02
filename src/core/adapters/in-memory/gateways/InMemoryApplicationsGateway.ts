import { Application, ApplicationsGateway } from "@core/domain";

export class InMemoryApplicationsGateway implements ApplicationsGateway {
  constructor(private readonly apps: Application[] = []) {}

  getAvailableApplications = async () => {
    return this.apps;
  };
}
