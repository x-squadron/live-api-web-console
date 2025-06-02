import { GetAvailableApps } from "@core";
import { Dependencies } from "./Dependencies";
import {
  ComposioApplicationMapper,
  ComposioApplicationsGateway,
} from "@core/adapters";
export const setupRealDependencies = (): Dependencies => {
  const composioAppsMapper = new ComposioApplicationMapper();
  const applicationsGateway = new ComposioApplicationsGateway(
    composioAppsMapper
  );
  return { getAvailableApps: new GetAvailableApps(applicationsGateway) };
};
