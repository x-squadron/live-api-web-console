import { GetApplicationTools, GetAvailableApps } from "@core";

export interface Usecases {
  getAvailableApps: GetAvailableApps;
  getApplicationTools: GetApplicationTools;
}

export interface Dependencies extends Usecases {}
