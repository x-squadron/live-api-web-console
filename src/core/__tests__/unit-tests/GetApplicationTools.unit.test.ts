import { GetApplicationTools } from "@core";
import { InMemoryToolsGateway } from "@core/adapters";
import { Tool } from "@core/domain";

describe("GetApplicationTools", () => {
  let sut: GetApplicationTools;

  it("Should be able to list available tools for an application", async () => {
    const appName = "GOOGLECALENDAR";
    const tools: Tool[] = [
      new Tool("GOOGLECALENDAR_UPDATE_EVENT", "GOOGLECALENDAR"),
      new Tool("GOOGLECALENDAR_CREATE_EVENT", "GOOGLECALENDAR"),
      new Tool("GOOGLECALENDAR_DELETE_EVENT", "GOOGLECALENDAR"),
      new Tool("SLACK_CONVERSATIONS_LIST", "SLACK"),
      new Tool("SLACK_CONVERSATIONS_HISTORY", "SLACK"),
    ];
    givenExistingTools(tools);
    const result = await sut.execute({ appName: appName });
    thenAvailableToolsAre(result, appName, tools);
  });

  function givenExistingTools(tools: Tool[]) {
    let toolsGateway: InMemoryToolsGateway = new InMemoryToolsGateway(tools);
    sut = new GetApplicationTools(toolsGateway);
  }

  function thenAvailableToolsAre(
    result: Tool[],
    appName: string,
    expectedTools: Tool[]
  ) {
    expect(result).toStrictEqual(
      expectedTools.filter((tool) => tool.appName === appName)
    );
  }
});
