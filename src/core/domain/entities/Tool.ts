export class Tool {
  constructor(
    public readonly name: string,
    public readonly appName: string,
    public readonly description: string = "No description available",
    public readonly tags: string[] = [],
    public readonly enabled: boolean = false
  ) {}
}
