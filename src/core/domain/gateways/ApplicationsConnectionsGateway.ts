import { ApplicationConnection } from "@core/domain";
export interface ApplicationsConnectionsGateway {
  checkConnectionStatus: () => Promise<ApplicationConnection[]>;
}
