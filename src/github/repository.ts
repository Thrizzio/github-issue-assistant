import { GitHubClient } from "./client.js";

export interface RepoDetails {
  owner: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  isPrivate: boolean;
  htmlUrl: string;
}

export class GitHubRepositoryService {
  constructor(private readonly client: GitHubClient) {}

  async getRepository(owner: string, repo: string): Promise<RepoDetails> {
    try {
      const response = await this.client.getOctokit().repos.get({
        owner,
        repo,
      });

      return {
        owner: response.data.owner.login,
        name: response.data.name,
        defaultBranch: response.data.default_branch,
        description: response.data.description,
        isPrivate: response.data.private,
        htmlUrl: response.data.html_url,
      };
    } catch (err) {
      this.client.handleApiError(err, owner, repo);
    }
  }
}
