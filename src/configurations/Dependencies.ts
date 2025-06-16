import {
  GetApplicationTools,
  GetAvailableApps,
  CheckConnectionStatus,
  GenerateTaskListForInterval,
} from "@core";

export interface Usecases {
  getAvailableApps: GetAvailableApps;
  getApplicationTools: GetApplicationTools;
  checkConnectionStatus: CheckConnectionStatus;
  generateTaskListForInterval: GenerateTaskListForInterval;
}

export interface Dependencies extends Usecases {}
