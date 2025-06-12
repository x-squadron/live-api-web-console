import { TimeInterval, TaskItem } from "@core/domain";

export interface TaskListGateway {
  generateTaskListForInterval: (
    timeInterval: TimeInterval
  ) => Promise<TaskItem[]>;
}
