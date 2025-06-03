import { GetAvailableApps } from "@core";
import { InMemoryApplicationsGateway } from "@core/adapters";
import { Application } from "@core/domain";

describe("GetAvailableApps", () => {
  let sut: GetAvailableApps;

  it("Should be able to list available apps", async () => {
    const apps: Application[] = [
      new Application("GMAIL", "LOGO"),
      new Application("LINEAR", "LOGO"),
    ];
    givenExistingApps(apps);
    const result = await sut.execute({});
    expect(result).toStrictEqual(apps);
  });

  function givenExistingApps(apps: Application[]) {
    let appsGateway: InMemoryApplicationsGateway =
      new InMemoryApplicationsGateway(apps);
    sut = new GetAvailableApps(appsGateway);
  }
});
