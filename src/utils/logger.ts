import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LoggerOptions {
  verbose?: boolean;
  silent?: boolean;
}

export class Logger {
  private verbose = false;
  private silent = false;

  constructor(options?: LoggerOptions) {
    if (options?.verbose) this.verbose = true;
    if (options?.silent) this.silent = true;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  isVerbose(): boolean {
    return this.verbose;
  }

  /**
   * Sanitizes strings to prevent credential leaks (tokens, keys, bearer headers).
   */
  private sanitize(message: string): string {
    return message
      .replace(/(ghp_[A-Za-z0-9_]{10,})/g, "ghp_***REDACTED***")
      .replace(/(github_pat_[A-Za-z0-9_]{10,})/g, "github_pat_***REDACTED***")
      .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, "$1***REDACTED***")
      .replace(/(key=)[A-Za-z0-9_.-]+/gi, "$1***REDACTED***")
      .replace(/(token=)[A-Za-z0-9_.-]+/gi, "$1***REDACTED***")
      .replace(/AIza[0-9A-Za-z-_]{35}/g, "AIza***REDACTED***");
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.verbose && !this.silent) {
      console.log(chalk.gray(`[DEBUG] ${this.sanitize(message)}`), ...args);
    }
  }

  info(message: string): void {
    if (!this.silent) {
      console.log(this.sanitize(message));
    }
  }

  warn(message: string): void {
    if (!this.silent) {
      console.warn(chalk.yellow(`[WARN] ${this.sanitize(message)}`));
    }
  }

  error(message: string, error?: unknown): void {
    if (!this.silent) {
      console.error(chalk.red(`[ERROR] ${this.sanitize(message)}`));
      if (this.verbose && error) {
        console.error(error);
      }
    }
  }

  success(message: string): void {
    if (!this.silent) {
      console.log(chalk.green(`✓ ${this.sanitize(message)}`));
    }
  }
}

export const logger = new Logger();
