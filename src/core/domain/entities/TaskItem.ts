export class TaskItem {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly status: "pending" | "in_progress" | "completed" = "pending",
    public readonly dueDate: Date | null = null,
    public readonly timeEstimation: number | null = null,
    public readonly priority: "low" | "medium" | "high" = "medium",
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly category: "work" | "personal" | "other" = "other",
    public readonly source?: string // calendar, linear, user
  ) {}
}
