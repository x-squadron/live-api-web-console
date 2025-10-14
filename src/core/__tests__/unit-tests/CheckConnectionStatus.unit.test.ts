import { CheckConnectionStatus } from "@core";
import { InMemoryApplicationsConnectionsGateway } from "@core/adapters";
import { ApplicationConnection } from "@core/domain";

describe("CheckConnectionStatus", () => {
  let sut: CheckConnectionStatus;

  it("should return the connection status of all applications", async () => {
    const connectionStatuses: ApplicationConnection[] = [
      new ApplicationConnection("gmail", "Active", "user1", new Date()),
      new ApplicationConnection("linear", "Inactive", "user2", new Date()),
    ];

    givenExistingConnectionStatuses(connectionStatuses);

    const result = await sut.execute({});
    expect(result).toStrictEqual(connectionStatuses);
  });

  function givenExistingConnectionStatuses(statuses: ApplicationConnection[]) {
    const connectionsGateway = new InMemoryApplicationsConnectionsGateway(
      statuses
    );
    sut = new CheckConnectionStatus(connectionsGateway);
  }
});
