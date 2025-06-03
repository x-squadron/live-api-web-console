import { GetApplicationTools, GetAvailableApps } from "@core";
import { Dependencies } from "./Dependencies";
import {
  ComposioApplicationMapper,
  ComposioApplicationsGateway,
  ComposioToolMapper,
  ComposioToolsGateway,
} from "@core/adapters";

export const setupRealDependencies = (): Dependencies => {
  const composioAppsMapper = new ComposioApplicationMapper();
  const applicationsGateway = new ComposioApplicationsGateway(
    composioAppsMapper
  );
  const composioToolsMapper = new ComposioToolMapper();
  const composioToolsGateway = new ComposioToolsGateway(composioToolsMapper);
  return {
    getAvailableApps: new GetAvailableApps(applicationsGateway),
    getApplicationTools: new GetApplicationTools(composioToolsGateway),
  };
};
