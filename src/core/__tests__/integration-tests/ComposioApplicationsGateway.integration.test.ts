import {
  ComposioApplicationMapper,
  ComposioApplicationsGateway,
} from "@core/adapters";

describe("ComposioApplicationsGateway", () => {
  let sut: ComposioApplicationsGateway;

  it("Should be able to list composio available apps", async () => {
    sut = new ComposioApplicationsGateway(new ComposioApplicationMapper());
    const result = await sut.getAvailableApplications();
    expect(result).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          name: "gmail",
          categories: ["Collaboration & Communication"],
        }),
        expect.objectContaining({ name: "slack" }),
        expect.objectContaining({ name: "linear" }),
        expect.objectContaining({
          name: "airtable",
          categories: [
            "Productivity & Project Management",
            "Workflow Automation",
          ],
        }),
      ])
    );
  });
});
