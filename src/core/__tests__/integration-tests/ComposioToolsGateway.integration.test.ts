import { ComposioToolMapper, ComposioToolsGateway } from "@core/adapters";

describe("ComposioToolsGateway", () => {
  let sut: ComposioToolsGateway;

  it("Should be able to list composio available tools for google calendar app", async () => {
    sut = new ComposioToolsGateway(new ComposioToolMapper());

    const appName = "googlecalendar";

    const result = await sut.getApplicationTools(appName);

    expect(result).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "GOOGLECALENDAR_CREATE_EVENT",
          appName: appName,
        }),
        expect.objectContaining({
          name: "GOOGLECALENDAR_UPDATE_EVENT",
          appName: appName,
        }),
      ])
    );
  });
});
