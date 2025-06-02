import { GetAvailableApps } from "@core";

export interface Usecases {
  getAvailableApps: GetAvailableApps;
}

export interface Dependencies extends Usecases {}
