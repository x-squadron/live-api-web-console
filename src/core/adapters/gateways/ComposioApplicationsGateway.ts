import { ApplicationsGateway } from "@core/domain";
import { ComposioApplicationMapper } from "@core/adapters";
import { Composio } from "composio-core";

export class ComposioApplicationsGateway implements ApplicationsGateway {
  composio = new Composio({
    apiKey: process.env.REACT_APP_COMPOSIO_API_KEY,
  });

  constructor(private readonly appsMapper: ComposioApplicationMapper) {}

  getAvailableApplications = async () => {
    console.log(
      "process.env.REACT_APP_COMPOSIO_API_KEY:",
      process.env.REACT_APP_COMPOSIO_API_KEY
    );

    const raw = await this.composio.apps.list();
    return (
      raw
        // @ts-ignore
        .filter((app) => app.auth_schemes?.includes("OAUTH2"))
        .map((app) => this.appsMapper.toDomain(app))
    );
  };
}
