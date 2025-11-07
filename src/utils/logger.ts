/**
 * Centralized logging utility
 * Replaces scattered debugLog calls throughout the codebase
 */

import { CONFIG } from "../config/constants.ts";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = CONFIG.DEBUG_MODE ? LogLevel.DEBUG : LogLevel.INFO;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(format: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${format}`, ...args);
    }
  }

  info(format: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${format}`, ...args);
    }
  }

  warn(format: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${format}`, ...args);
    }
  }

  error(format: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${format}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Backward compatibility - keep debugLog function signature
export function debugLog(format: string, ...args: unknown[]): void {
  logger.debug(format, ...args);
}
