import { Mapper, ApplicationConnection } from "@core/domain";
import { ConnectionItem } from "composio-core";

export class ComposioConnectionMapper
  implements Mapper<ApplicationConnection, ConnectionItem & { userId: string }>
{
  toDomain(raw: ConnectionItem & { userId: string }): ApplicationConnection {
    return new ApplicationConnection(
      raw.appName,
      mapRawStatus(raw.status),
      raw.userId,
      new Date(raw.updatedAt),
      raw.status !== "ACTIVE" ? `Status: ${raw.status}` : undefined
    );
  }
}

// Normalize raw connection status to domain status
function mapRawStatus(
  raw?: string
): "Active" | "Inactive" | "Initiated" | "Expired" {
  switch (raw?.toUpperCase()) {
    case "ACTIVE":
      return "Active";
    case "INITIALIZING":
      return "Initiated";
    case "EXPIRED":
      return "Expired";
    default:
      return "Inactive";
  }
}
