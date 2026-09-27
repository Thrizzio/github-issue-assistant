import { GitClient } from "../archaeology/git.js";
import { GitRemoteError, NotGitRepositoryError } from "../utils/errors.js";

export interface RepoCoordinates {
  owner: string;
  name: string;
  remoteUrl: string;
  currentCommit: string;
  rootDir: string;
}

/**
 * Parses owner and repository name from a GitHub remote URL or slug string.
 */
export function parseGitHubUrl(urlOrSlug: string): { owner: string; repo: string } {
  const clean = urlOrSlug.trim();

  // Pattern 1: owner/repo format
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(clean)) {
    const [owner, repo] = clean.split("/");
    return { owner, repo: repo.replace(/\.git$/, "") };
  }

  // Pattern 2: SSH format: git@github.com:owner/repo.git or ssh://git@github.com/owner/repo.git
  const sshMatch = clean.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch && sshMatch[1] && sshMatch[2]) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Pattern 3: HTTPS format: https://[user:pass@]github.com/owner/repo.git
  const httpsMatch = clean.match(/^https?:\/\/(?:[^@]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch && httpsMatch[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  throw new GitRemoteError(
    `Cannot parse GitHub repository from URL/slug: "${clean}". Expected format "owner/repo", "https://github.com/owner/repo", or "git@github.com:owner/repo.git"`,
  );
}

export class RepositoryDetector {
  constructor(private readonly git: GitClient = new GitClient()) {}

  /**
   * Detects the git repository in the target directory and resolves repo coordinates.
   * If repoOverride (e.g. from --repo flag) is provided, it takes precedence.
   */
  async detect(targetDir = process.cwd(), repoOverride?: string): Promise<RepoCoordinates> {
    const isRepo = await this.git.isGitRepository();
    if (!isRepo) {
      throw new NotGitRepositoryError(targetDir);
    }

    const rootDir = await this.git.getGitRoot();
    let currentCommit = "unknown";
    try {
      currentCommit = await this.git.getCurrentCommit(false);
    } catch {
      // Empty repo or uncommitted initial state
      currentCommit = "UNCOMMITTED";
    }

    if (repoOverride) {
      const parsed = parseGitHubUrl(repoOverride);
      return {
        owner: parsed.owner,
        name: parsed.repo,
        remoteUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
        currentCommit,
        rootDir,
      };
    }

    // Try detecting origin remote
    try {
      const remoteUrl = await this.git.getRemoteUrl("origin");
      const parsed = parseGitHubUrl(remoteUrl);
      return {
        owner: parsed.owner,
        name: parsed.repo,
        remoteUrl,
        currentCommit,
        rootDir,
      };
    } catch (err) {
      // If origin fails, check any remotes
      const remotes = await this.git.getRemotes();
      for (const remote of remotes) {
        try {
          const url = await this.git.getRemoteUrl(remote);
          const parsed = parseGitHubUrl(url);
          return {
            owner: parsed.owner,
            name: parsed.repo,
            remoteUrl: url,
            currentCommit,
            rootDir,
          };
        } catch {
          // Continue to next remote
        }
      }

      throw new GitRemoteError(
        `Could not detect a GitHub remote in repository at ${rootDir}. ` +
          `Specify --repo <owner/repo> to manually configure the GitHub repository.`,
      );
    }
  }
}
