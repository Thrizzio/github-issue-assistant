import { PullRequestService } from "../github/pullRequests.js";
import { DiscoveredSymbol } from "../repository/symbols.js";
import { GitCommit } from "./commits.js";
import { GitClient } from "./git.js";

export interface SymbolProvenance {
  symbolName: string;
  filePath: string;
  probableIntroducingCommit?: GitCommit;
  introductionConfidence: "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "UNCERTAIN";
  introductionEvidence: string;
  recentModifyingCommits: GitCommit[];
}

export class ProvenanceAnalyzer {
  constructor(
    private readonly git: GitClient,
    private readonly prService?: PullRequestService,
    private readonly owner?: string,
    private readonly repo?: string,
  ) {}

  /**
   * Discovers historical origin and modifying commits for candidate symbols.
   */
  async analyzeSymbolProvenance(
    symbol: DiscoveredSymbol,
  ): Promise<SymbolProvenance> {
    try {
      // 1. Try git log -S for the exact symbol name
      const pickaxeCommits = await this.git.logPickaxe(symbol.name, symbol.filePath);

      let probableIntroducingCommit: GitCommit | undefined;
      let introductionConfidence: "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "UNCERTAIN" =
        "UNCERTAIN";
      let introductionEvidence = "";
      const modifyingCommits: GitCommit[] = [];

      if (pickaxeCommits.length > 0) {
        // In git log order (newest to oldest), the oldest commit is the last one
        const oldest = pickaxeCommits[pickaxeCommits.length - 1];
        probableIntroducingCommit = oldest;
        introductionConfidence = "MEDIUM_CONFIDENCE";
        introductionEvidence = `Identified via git log -S "${symbol.name}" in ${symbol.filePath} (earliest commit adding/removing token)`;

        // Modifying commits are the newer ones
        for (let i = 0; i < Math.min(3, pickaxeCommits.length - 1); i++) {
          modifyingCommits.push(pickaxeCommits[i]);
        }
      } else {
        // Fallback to file history
        const fileCommits = await this.git.getFileHistory(symbol.filePath, 10);
        if (fileCommits.length > 0) {
          const oldest = fileCommits[fileCommits.length - 1];
          probableIntroducingCommit = oldest;
          introductionConfidence = "LOW_CONFIDENCE";
          introductionEvidence = `Derived from earliest recorded commit touching file ${symbol.filePath}; symbol-specific pickaxe search returned no discrete commits.`;

          for (let i = 0; i < Math.min(3, fileCommits.length - 1); i++) {
            modifyingCommits.push(fileCommits[i]);
          }
        } else {
          introductionEvidence = `No Git commit history found for file ${symbol.filePath}.`;
        }
      }

      // Best-effort PR association for introducing commit
      if (
        probableIntroducingCommit &&
        this.prService &&
        this.owner &&
        this.repo
      ) {
        const pr = await this.prService.getPRForCommit(
          this.owner,
          this.repo,
          probableIntroducingCommit.sha,
        );
        if (pr) {
          probableIntroducingCommit.associatedPR = {
            number: pr.number,
            title: pr.title,
            url: pr.url,
          };
        }
      }

      return {
        symbolName: symbol.name,
        filePath: symbol.filePath,
        probableIntroducingCommit,
        introductionConfidence,
        introductionEvidence,
        recentModifyingCommits: modifyingCommits,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        symbolName: symbol.name,
        filePath: symbol.filePath,
        introductionConfidence: "UNCERTAIN",
        introductionEvidence: `Git provenance analysis failed: ${msg}`,
        recentModifyingCommits: [],
      };
    }
  }
}
