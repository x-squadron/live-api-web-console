import { GenerateTaskListForInterval } from "@core";
import { InMemoryTaskListGateway } from "@core/adapters";
import { TaskItem, TimeInterval } from "@core/domain";

describe("GenerateTaskListForInterval", () => {
  it("returns tasks that fall within the given interval", async () => {
    const interval = new TimeInterval(
      new Date("2025-06-15"),
      new Date("2025-06-18")
    );

    const taskInside = new TaskItem(
      "1",
      "Inside",
      "",
      "pending",
      new Date("2025-06-16")
    );
    const taskOutside = new TaskItem(
      "2",
      "Outside",
      "",
      "pending",
      new Date("2025-06-20")
    );

    const gateway = new InMemoryTaskListGateway([taskInside, taskOutside]);
    const sut = new GenerateTaskListForInterval(gateway);

    const result = await sut.execute({ interval });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});
