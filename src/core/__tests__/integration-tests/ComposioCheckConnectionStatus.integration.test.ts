import {
  ComposioApplicationsConnectionGateway,
  ComposioApplicationsGateway,
  ComposioConnectionMapper,
  ComposioApplicationMapper,
} from "@core/adapters";

describe("ComposioApplicationsConnectionGateway", () => {
  let sut: ComposioApplicationsConnectionGateway;

  beforeEach(() => {
    sut = new ComposioApplicationsConnectionGateway(
      new ComposioConnectionMapper(),
      new ComposioApplicationsGateway(new ComposioApplicationMapper())
    );
  });

  it("should return correct connection statuses for Gmail and Notion", async () => {
    const result = await sut.checkConnectionStatus();

    expect(result.length).toBeGreaterThan(0);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          appName: "gmail",
          status: "Active",
        }),
        expect.objectContaining({
          appName: "amazon",
          status: "Initiated",
        }),
      ])
    );
  });
});
