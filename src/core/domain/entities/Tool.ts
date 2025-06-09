export class Tool {
  constructor(
    public readonly name: string,
    public readonly appName: string,
    public readonly description: string = "No description available",
    public readonly parameters: Record<string, unknown> = {},
    public readonly tags: string[] = [],
    public readonly enabled: boolean = false
  ) {}
}
