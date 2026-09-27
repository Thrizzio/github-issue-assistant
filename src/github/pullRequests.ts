import { GitHubClient } from "./client.js";

export interface AssociatedPR {
  number: number;
  title: string;
  url: string;
  mergedAt: string | null;
  author: string | null;
}

export class PullRequestService {
  constructor(private readonly client: GitHubClient) {}

  /**
   * Attempts to retrieve pull requests associated with a commit SHA.
   * Best-effort; returns undefined if no PR is found or if request fails.
   */
  async getPRForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<AssociatedPR | undefined> {
    try {
      const response = await this.client.getOctokit().repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
      });

      const prs = response.data;
      if (!prs || prs.length === 0) {
        return undefined;
      }

      // Pick the first associated PR
      const first = prs[0];
      return {
        number: first.number,
        title: first.title,
        url: first.html_url,
        mergedAt: first.merged_at ?? null,
        author: first.user?.login ?? null,
      };
    } catch {
      // Best-effort: return undefined on any error (unauthenticated, rate limit, commit not found on remote)
      return undefined;
    }
  }
}
