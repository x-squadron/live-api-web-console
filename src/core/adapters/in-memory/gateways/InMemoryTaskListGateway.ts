import { TaskItem, TaskListGateway, TimeInterval } from "@core/domain";

export class InMemoryTaskListGateway implements TaskListGateway {
  generateTaskListForInterval(interval: TimeInterval): Promise<TaskItem[]> {
    throw new Error("Method not implemented.");
  }
}
