export abstract class IssuePilotError extends Error {
  abstract readonly code: string;
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GenericIssuePilotError extends IssuePilotError {
  readonly code = "INTERNAL_ERROR";
}

export class CliError extends IssuePilotError {
  readonly code = "CLI_ERROR";
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}


export class GitHubApiError extends IssuePilotError {
  readonly code = "GITHUB_API_ERROR";
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class NotGitRepositoryError extends IssuePilotError {
  readonly code = "NOT_GIT_REPOSITORY";
  constructor(path: string) {
    super(`Directory is not a Git repository: ${path}`);
  }
}

export class GitRemoteError extends IssuePilotError {
  readonly code = "GIT_REMOTE_ERROR";
  constructor(message: string) {
    super(message);
  }
}

export class GitCommandError extends IssuePilotError {
  readonly code = "GIT_COMMAND_ERROR";
  constructor(
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`Git command failed [${command}]: ${stderr.trim() || `Exit code ${exitCode}`}`);
  }
}

export class GitHubAuthenticationError extends IssuePilotError {
  readonly code = "GITHUB_AUTHENTICATION_ERROR";
  constructor(message = "GitHub authentication failed or token is missing/invalid.") {
    super(message);
  }
}

export class GitHubRepositoryNotFoundError extends IssuePilotError {
  readonly code = "GITHUB_REPOSITORY_NOT_FOUND";
  constructor(owner: string, repo: string) {
    super(`GitHub repository not found or inaccessible: ${owner}/${repo}`);
  }
}

export class GitHubIssueNotFoundError extends IssuePilotError {
  readonly code = "GITHUB_ISSUE_NOT_FOUND";
  constructor(owner: string, repo: string, issueNumber: number) {
    super(`GitHub issue #${issueNumber} not found in ${owner}/${repo}`);
  }
}

export class GitHubRateLimitError extends IssuePilotError {
  readonly code = "GITHUB_RATE_LIMIT_ERROR";
  constructor(resetDate?: string) {
    super(`GitHub API rate limit exceeded.${resetDate ? ` Resets at ${resetDate}.` : ""}`);
  }
}

export class TypeScriptAnalysisError extends IssuePilotError {
  readonly code = "TYPESCRIPT_ANALYSIS_ERROR";
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class LLMProviderError extends IssuePilotError {
  readonly code = "LLM_PROVIDER_ERROR";
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}
