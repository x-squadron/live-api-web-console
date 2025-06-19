import { Usecase } from "./Usecase";
import { TimeInterval, TaskItem, TaskListGateway } from "@core/domain";

type GenerateTaskListForIntervalInputPort = {
  interval: TimeInterval;
};

type GenerateTaskListForIntervalOutputPort = {};

export class GenerateTaskListForInterval
  implements
    Usecase<
      GenerateTaskListForIntervalInputPort,
      GenerateTaskListForIntervalOutputPort,
      TaskItem[]
    >
{
  constructor(private readonly TaskListGateway: TaskListGateway) {}

  async execute(
    inputs: GenerateTaskListForIntervalInputPort,
    outputs?: GenerateTaskListForIntervalOutputPort
  ): Promise<TaskItem[]> {
    return await this.TaskListGateway.generateTaskListForInterval(
      inputs.interval
    );
  }
}
