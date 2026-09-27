import { Octokit } from "@octokit/rest";
import {
  GitHubApiError,
  GitHubAuthenticationError,
  GitHubIssueNotFoundError,
  GitHubRateLimitError,
  GitHubRepositoryNotFoundError,
  IssuePilotError,
} from "../utils/errors.js";

export interface GitHubClientOptions {
  token?: string;
}

export class GitHubClient {
  private readonly octokit: Octokit;
  private readonly hasToken: boolean;

  constructor(options?: GitHubClientOptions) {
    const token = options?.token || process.env.GITHUB_TOKEN;
    this.hasToken = Boolean(token && token.trim().length > 0);

    this.octokit = new Octokit({
      auth: this.hasToken ? token : undefined,
      userAgent: "issuepilot-cli/1.0.0",
    });
  }

  getOctokit(): Octokit {
    return this.octokit;
  }

  isAuthenticated(): boolean {
    return this.hasToken;
  }

  /**
   * Translates Octokit HTTP errors into typed domain errors.
   */
  handleApiError(error: unknown, owner: string, repo: string, issueNumber?: number): never {
    const err = error as {
      status?: number;
      message?: string;
      response?: { headers?: Record<string, string> };
    };

    if (err.status === 401 || err.status === 403) {
      if (err.response?.headers?.["x-ratelimit-remaining"] === "0") {
        const resetHeader = err.response.headers["x-ratelimit-reset"];
        const resetDate = resetHeader
          ? new Date(Number(resetHeader) * 1000).toISOString()
          : undefined;
        throw new GitHubRateLimitError(resetDate);
      }
      throw new GitHubAuthenticationError(
        "GitHub API authentication failed. Please verify your token or set GITHUB_TOKEN.",
      );
    }

    if (err.status === 404) {
      if (issueNumber !== undefined) {
        throw new GitHubIssueNotFoundError(owner, repo, issueNumber);
      }
      throw new GitHubRepositoryNotFoundError(owner, repo);
    }

    if (error instanceof IssuePilotError) {
      throw error;
    }

    throw new GitHubApiError(`GitHub API error: ${err.message || String(error)}`, error);
  }
}
