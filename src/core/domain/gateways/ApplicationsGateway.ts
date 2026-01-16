import { Application } from "@core/domain";
export interface ApplicationsGateway {
  getAvailableApplications: () => Promise<Application[]>;
}
