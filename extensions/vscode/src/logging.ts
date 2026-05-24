export class Logger {
  public constructor(private readonly isDebugEnabled: () => boolean) {}

  public debug(message: string, extra?: unknown): void {
    if (!this.isDebugEnabled()) {
      return;
    }
    console.log("[wakaclock]", message, extra ?? "");
  }

  public warn(message: string, extra?: unknown): void {
    console.warn("[wakaclock]", message, extra ?? "");
  }

  public error(message: string, extra?: unknown): void {
    console.error("[wakaclock]", message, extra ?? "");
  }
}
