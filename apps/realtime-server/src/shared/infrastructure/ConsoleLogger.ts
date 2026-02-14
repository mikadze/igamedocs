import type { Logger } from '@shared/ports/Logger';

export class ConsoleLogger implements Logger {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, context ?? '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ?? '');
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, context ?? '');
  }
}
