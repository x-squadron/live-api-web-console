import { Tool, ToolsGateway } from "@core/domain";
import { ActionDetails, Composio } from "composio-core";
import { ComposioToolMapper } from "@core/adapters";

export class ComposioToolsGateway implements ToolsGateway {
  private readonly composio: Composio;

  constructor(private readonly toolsMapper: ComposioToolMapper) {
    this.composio = new Composio({
      apiKey: process.env.REACT_APP_COMPOSIO_API_KEY,
    });
  }

  getApplicationTools = async (appName: string): Promise<Tool[]> => {
    const raw = await this.composio.actions.list({
      apps: appName.toLowerCase(),
    });

    return raw.items.map((action: ActionDetails) =>
      this.toolsMapper.toDomain(action)
    );
  };
}
