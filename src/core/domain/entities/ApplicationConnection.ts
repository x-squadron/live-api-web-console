export class ApplicationConnection {
  constructor(
    readonly appName: string,
    readonly status: "Active" | "Inactive" | "Initiated" | "Expired",
    readonly userId: string,
    readonly lastChecked?: Date,
    readonly error?: string
  ) {}
}
