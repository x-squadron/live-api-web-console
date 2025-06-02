import { GetAvailableApps } from "@core";

describe("GetAvailableApps", () => {
  let sut: GetAvailableApps;

  beforeEach(() => {
    sut = new GetAvailableApps();
  });

  it("Should be able to list available apps", async () => {
    const result = await sut.execute({});
    expect(result).toBe([]);
  });
});
