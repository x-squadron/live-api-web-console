export class TimeInterval {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
    public readonly label?: string // next week, yesterday, today, tomorrow ...
  ) {}
}
