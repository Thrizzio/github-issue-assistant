export interface GitCommit {
  sha: string;
  shortSha: string;
  author: string;
  date: string; // ISO 8601
  message: string;
  body?: string;
  associatedPR?: {
    number: number;
    title: string;
    url: string;
  };
}

export const GIT_LOG_FORMAT = "%H%x00%h%x00%an%x00%aI%x00%s%x00%b%x1e";

/**
 * Parses raw git log output formatted with GIT_LOG_FORMAT into GitCommit objects.
 */
export function parseGitLogOutput(rawOutput: string): GitCommit[] {
  if (!rawOutput || !rawOutput.trim()) {
    return [];
  }

  const records = rawOutput.split("\x1e");
  const commits: GitCommit[] = [];

  for (const record of records) {
    const trimmed = record.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("\x00");
    if (parts.length >= 5) {
      const [sha, shortSha, author, date, message, body] = parts;
      commits.push({
        sha: sha.trim(),
        shortSha: shortSha.trim(),
        author: author.trim(),
        date: date.trim(),
        message: message.trim(),
        body: body ? body.trim() : undefined,
      });
    }
  }

  return commits;
}
