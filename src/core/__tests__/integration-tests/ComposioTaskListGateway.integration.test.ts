import { ComposioTaskListGateway } from "@core/adapters";
import { TaskItem, TimeInterval } from "@core/domain";

describe("ComposioTaskListGateway (Integration)", () => {
  let sut: ComposioTaskListGateway;

  const apiKey = process.env.REACT_APP_COMPOSIO_API_KEY;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error("REACT_APP_COMPOSIO_API_KEY is not set");
    }

    sut = new ComposioTaskListGateway(apiKey);
  });

  it("should return tasks from Google Calendar and Linear within the given interval", async () => {
    const interval = new TimeInterval(
      new Date("2025-06-15T00:00:00.000Z"),
      new Date("2025-06-23T23:59:59.999Z")
    );

    const result: TaskItem[] = await sut.generateTaskListForInterval(interval);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    result.forEach((task) => {
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("description");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("priority");
      expect(task).toHaveProperty("source");
    });

    console.log(
      `[IntegrationTest] Found ${result.length} tasks:`,
      result.map((t) => ({
        title: t.title,
        due: t.dueDate?.toISOString(),
        source: t.source,
      }))
    );
  }, 20000); // ← timeout in ms (20s)
});
