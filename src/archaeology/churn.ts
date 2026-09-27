import { GitCommit } from "./commits.js";
import { GitClient } from "./git.js";

export interface ChurnReport {
  timeWindowMonths: number;
  sinceDate: string;
  totalCommits: number;
  commitsByFile: Record<string, number>;
  recentCommits: GitCommit[];
  filteredFormattingCommits: number;
}

export class ChurnAnalyzer {
  constructor(private readonly git: GitClient) {}

  /**
   * Calculates recent commit churn across relevant files over a time window.
   */
  async calculateChurn(
    filePaths: string[],
    churnMonths = 6,
  ): Promise<ChurnReport> {
    if (filePaths.length === 0) {
      return {
        timeWindowMonths: churnMonths,
        sinceDate: new Date().toISOString(),
        totalCommits: 0,
        commitsByFile: {},
        recentCommits: [],
        filteredFormattingCommits: 0,
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - churnMonths);
    const sinceDate = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    try {
      const rawCommits = await this.git.getCommitsSince(filePaths, sinceDate);

      let filteredFormattingCount = 0;
      const filteredCommits: GitCommit[] = [];

      for (const commit of rawCommits) {
        const msg = commit.message.toLowerCase();
        // Filter obvious mass formatting commits
        if (
          msg.startsWith("style:") ||
          msg.includes("reformat") ||
          msg.includes("prettier") ||
          msg.includes("format code")
        ) {
          filteredFormattingCount++;
          continue;
        }
        filteredCommits.push(commit);
      }

      // Tally commits per file (best effort: check individual files if needed or distribute)
      const commitsByFile: Record<string, number> = {};
      for (const f of filePaths) {
        commitsByFile[f] = 0;
      }

      // For up to 10 files, query individual counts
      for (const f of filePaths.slice(0, 10)) {
        try {
          const fileCommits = await this.git.getCommitsSince([f], sinceDate);
          commitsByFile[f] = fileCommits.length;
        } catch {
          commitsByFile[f] = 0;
        }
      }

      return {
        timeWindowMonths: churnMonths,
        sinceDate,
        totalCommits: filteredCommits.length,
        commitsByFile,
        recentCommits: filteredCommits.slice(0, 5),
        filteredFormattingCommits: filteredFormattingCount,
      };
    } catch {
      return {
        timeWindowMonths: churnMonths,
        sinceDate,
        totalCommits: 0,
        commitsByFile: {},
        recentCommits: [],
        filteredFormattingCommits: 0,
      };
    }
  }
}
