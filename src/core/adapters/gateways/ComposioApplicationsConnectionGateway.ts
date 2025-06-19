import {
  ApplicationConnection,
  ApplicationsConnectionsGateway,
} from "@core/domain";
import {
  ComposioConnectionMapper,
  ComposioApplicationsGateway,
} from "@core/adapters";
import { ComposioToolSet, ConnectionItem } from "composio-core";

export class ComposioApplicationsConnectionGateway
  implements ApplicationsConnectionsGateway
{
  private readonly userId: string;
  private readonly toolset: ComposioToolSet;

  constructor(
    private readonly connectionsMapper: ComposioConnectionMapper,
    private readonly appsGateway: ComposioApplicationsGateway
  ) {
    this.userId = process.env.REACT_APP_COMPOSIO_API_KEY ?? "default";
    this.toolset = new ComposioToolSet({ apiKey: this.userId });
  }

  checkConnectionStatus = async (): Promise<ApplicationConnection[]> => {
    try {
      const entity = await this.toolset.getEntity(this.userId);
      const allConnections: ConnectionItem[] = await entity.getConnections();
      const availableApps = await this.appsGateway.getAvailableApplications();

      const connectionMap = new Map<string, ConnectionItem>();
      allConnections.forEach((conn) => {
        if (conn.appName) {
          connectionMap.set(conn.appName.toLowerCase(), conn);
        }
      });

      return availableApps.map((app) => {
        const conn = connectionMap.get(app.name.toLowerCase());
        return conn
          ? this.connectionsMapper.toDomain({ ...conn, userId: this.userId })
          : new ApplicationConnection(
              app.name,
              "Inactive",
              this.userId,
              new Date(),
              "Not connected"
            );
      });
    } catch (error) {
      console.error("❌ Error checking application connections:", error);
      return [];
    }
  };
}
