import { TaskItem, TimeInterval, TaskListGateway } from "@core/domain";

export class InMemoryTaskListGateway implements TaskListGateway {
  constructor(private readonly tasks: TaskItem[] = []) {}

  async generateTaskListForInterval(
    interval: TimeInterval
  ): Promise<TaskItem[]> {
    return this.tasks.filter((task) => {
      if (!task.dueDate) return false;
      return task.dueDate >= interval.start && task.dueDate <= interval.end;
    });
  }
}
