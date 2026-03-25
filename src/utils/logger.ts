/**
 * Logger utility
 * For now, uses console logging. Can be replaced with Winston, Pino, etc.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = this.getTimestamp();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
  }

  public info(message: string, meta?: unknown): void {
    console.log(this.formatMessage('info', message, meta));
  }

  public warn(message: string, meta?: unknown): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  public error(message: string, meta?: unknown): void {
    console.error(this.formatMessage('error', message, meta));
  }

  public debug(message: string, meta?: unknown): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
