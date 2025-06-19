import {
  GetApplicationTools,
  GetAvailableApps,
  CheckConnectionStatus,
  GenerateTaskListForInterval,
} from "@core";
import { Dependencies } from "./Dependencies";
import {
  ComposioApplicationMapper,
  ComposioApplicationsGateway,
  ComposioToolMapper,
  ComposioToolsGateway,
  ComposioConnectionMapper,
  ComposioApplicationsConnectionGateway,
  ComposioTaskListGateway,
} from "@core/adapters";

export const setupRealDependencies = (): Dependencies => {
  const composioAppsMapper = new ComposioApplicationMapper();
  const applicationsGateway = new ComposioApplicationsGateway(
    composioAppsMapper
  );
  const composioToolsMapper = new ComposioToolMapper();
  const composioToolsGateway = new ComposioToolsGateway(composioToolsMapper);

  const composioConnectionMapper = new ComposioConnectionMapper();
  const applicationsConnectionGateway =
    new ComposioApplicationsConnectionGateway(
      composioConnectionMapper,
      applicationsGateway
    );

  const composioTaskListGateway = new ComposioTaskListGateway(
    process.env.REACT_APP_COMPOSIO_API_KEY ?? ""
  );

  return {
    getAvailableApps: new GetAvailableApps(applicationsGateway),
    getApplicationTools: new GetApplicationTools(composioToolsGateway),
    checkConnectionStatus: new CheckConnectionStatus(
      applicationsConnectionGateway
    ),
    generateTaskListForInterval: new GenerateTaskListForInterval(
      composioTaskListGateway
    ),
  };
};
