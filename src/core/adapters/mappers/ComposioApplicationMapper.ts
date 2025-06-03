import { Application, Mapper } from "@core/domain";
import { AppInfoResponseDto } from "composio-core";

export class ComposioApplicationMapper
  implements Mapper<Application, AppInfoResponseDto>
{
  toDomain(raw: AppInfoResponseDto): Application {
    return new Application(
      raw.name,
      raw.logo,
      (Array.isArray(raw.categories)
        ? raw.categories.join(", ")
        : raw.categories ?? "Uncategorized"
      )
        .split(",")
        .map((category) => category.trim())
    );
  }
}
