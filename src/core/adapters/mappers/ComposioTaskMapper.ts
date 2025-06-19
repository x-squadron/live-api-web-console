import { TaskItem } from "@core/domain";

export class ComposioTaskMapper {
  fromGoogleCalendar(raw: any): TaskItem {
    return new TaskItem(
      raw.id,
      raw.summary ?? "Untitled event",
      raw.description ?? "",
      "pending",
      new Date(raw.end?.dateTime),
      null,
      "medium",
      new Date(raw.created),
      new Date(raw.updated),
      "work",
      "calendar"
    );
  }

  fromLinearIssue(raw: any): TaskItem {
    return new TaskItem(
      raw.id,
      raw.title,
      raw.description ?? "",
      raw.state?.name === "In Progress" ? "in_progress" : "pending",
      null,
      null,
      this.mapPriority(raw.priority),
      new Date(),
      new Date(),
      "work",
      "linear"
    );
  }

  // ➕ Other apps will be added here as needed

  private mapPriority(priority: number): "low" | "medium" | "high" {
    if (priority >= 2) return "high";
    if (priority === 1) return "medium";
    return "low";
  }
}
