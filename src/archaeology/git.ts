import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitCommandError, NotGitRepositoryError } from "../utils/errors.js";

const execFileAsync = promisify(execFile);

export interface GitExecOptions {
  cwd?: string;
  maxBuffer?: number;
  timeout?: number;
}

export class GitClient {
  constructor(private readonly workingDir: string = process.cwd()) {}

  /**
   * Safely executes a git command using execFile with an argument array.
   */
  async exec(args: string[], options?: GitExecOptions): Promise<string> {
    const cwd = options?.cwd ?? this.workingDir;
    const maxBuffer = options?.maxBuffer ?? 10 * 1024 * 1024; // 10MB
    const timeout = options?.timeout ?? 30000; // 30s

    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd,
        maxBuffer,
        timeout,
        windowsHide: true,
      });
      return stdout.trim();
    } catch (err: unknown) {
      const error = err as {
        code?: number | string;
        killed?: boolean;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      const stderr = error.stderr || error.message || "";
      const exitCode = typeof error.code === "number" ? error.code : null;

      if (stderr.includes("not a git repository")) {
        throw new NotGitRepositoryError(cwd);
      }

      throw new GitCommandError(`git ${args.join(" ")}`, exitCode, stderr);
    }
  }

  /**
   * Validates whether the directory is a git repository.
   */
  async isGitRepository(): Promise<boolean> {
    try {
      const out = await this.exec(["rev-parse", "--is-inside-work-tree"]);
      return out === "true";
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current HEAD commit SHA (abbreviated or full).
   */
  async getCurrentCommit(short = false): Promise<string> {
    const args = ["rev-parse"];
    if (short) args.push("--short");
    args.push("HEAD");
    return this.exec(args);
  }

  /**
   * Retrieves the root directory of the Git working tree.
   */
  async getGitRoot(): Promise<string> {
    return this.exec(["rev-parse", "--show-toplevel"]);
  }

  /**
   * Gets the remote URL for a named remote (default: 'origin').
   */
  async getRemoteUrl(remote = "origin"): Promise<string> {
    return this.exec(["remote", "get-url", remote]);
  }

  /**
   * Lists all configured remote names.
   */
  async getRemotes(): Promise<string[]> {
    try {
      const out = await this.exec(["remote"]);
      return out ? out.split(/\r?\n/).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  /**
   * Runs git log with GIT_LOG_FORMAT and returns parsed GitCommit array.
   */
  async logCommits(extraArgs: string[]): Promise<import("./commits.js").GitCommit[]> {
    const { GIT_LOG_FORMAT, parseGitLogOutput } = await import("./commits.js");
    const args = ["log", `--format=${GIT_LOG_FORMAT}`, ...extraArgs];
    try {
      const output = await this.exec(args);
      return parseGitLogOutput(output);
    } catch {
      return [];
    }
  }

  /**
   * Uses git log -S to find commits that introduced or removed occurrences of a symbol.
   */
  async logPickaxe(
    symbolName: string,
    filePath?: string,
  ): Promise<import("./commits.js").GitCommit[]> {
    const extraArgs = ["-S", symbolName, "-M", "-C"];
    if (filePath) {
      extraArgs.push("--follow", "--", filePath);
    }
    return this.logCommits(extraArgs);
  }

  /**
   * Returns commit history for a specific file.
   */
  async getFileHistory(
    filePath: string,
    maxCount = 20,
  ): Promise<import("./commits.js").GitCommit[]> {
    return this.logCommits(["-n", String(maxCount), "--follow", "--", filePath]);
  }

  /**
   * Returns commits touching the specified files since a given date.
   */
  async getCommitsSince(
    filePaths: string[],
    sinceDate: string,
  ): Promise<import("./commits.js").GitCommit[]> {
    if (filePaths.length === 0) return [];
    return this.logCommits(["--since", sinceDate, "--", ...filePaths]);
  }
}
