import { Injectable } from '@nestjs/common';
import { Logger } from '@shared/ports/Logger';

@Injectable()
export class ConsoleLogger implements Logger {
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ?? '');
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, context ?? '');
  }
}
