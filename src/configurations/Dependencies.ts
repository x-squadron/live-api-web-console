import {
  GetApplicationTools,
  GetAvailableApps,
  CheckConnectionStatus,
} from "@core";

export interface Usecases {
  getAvailableApps: GetAvailableApps;
  getApplicationTools: GetApplicationTools;
  checkConnectionStatus: CheckConnectionStatus;
}

export interface Dependencies extends Usecases {}
