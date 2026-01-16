import { Mapper, Tool } from "@core/domain";
import { ActionDetails } from "composio-core";

export class ComposioToolMapper implements Mapper<Tool, ActionDetails> {
  toDomain(raw: ActionDetails): Tool {
    return new Tool(
      raw.name,
      raw.appName,
      raw.description,
      raw.parameters,
      raw.tags
    );
  }
}
