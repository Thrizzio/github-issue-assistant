import fs from "node:fs";
import path from "node:path";
import { EvidenceGraph } from "../evidence/schema.js";
import { ContributorBrief } from "../synthesis/schema.js";
import { normalizePath } from "../utils/paths.js";

export class MarkdownReportGenerator {
  /**
   * Generates the CONTRIBUTOR_CONTEXT.md markdown content.
   */
  generate(evidence: EvidenceGraph, brief: ContributorBrief): string {
    const lines: string[] = [];

    lines.push("# Contributor Context");
    lines.push("");

    // Section 1: Issue
    lines.push("## Issue");
    lines.push(`- **Title**: ${evidence.issue.title}`);
    lines.push(`- **Number**: #${evidence.issue.number}`);
    lines.push(`- **URL**: [Issue #${evidence.issue.number}](${evidence.issue.url})`);
    lines.push(`- **State**: \`${evidence.issue.state}\``);
    lines.push(`- **Author**: @${evidence.issue.author}`);
    lines.push(`- **Labels**: ${evidence.issue.labels.length > 0 ? evidence.issue.labels.map((l) => `\`${l}\``).join(", ") : "_None_"}`);
    lines.push("");

    // Section 2: Observed Problem
    lines.push("## Observed Problem");
    lines.push("> **Explicit Issue Statement vs Inferred Analysis**");
    lines.push(">");
    lines.push(`> ${brief.observedProblem.split("\n").join("\n> ")}`);
    lines.push("");

    // Section 3: Evidence Summary
    lines.push("## Evidence Summary");
    lines.push("Relevant symbols and files discovered via deterministic AST indexing:");
    lines.push("");
    if (evidence.symbols.length === 0) {
      lines.push("_No specific TypeScript/JavaScript candidate symbols matched the issue criteria._");
    } else {
      lines.push("| Symbol | Kind | File | Range | Confidence | References | Reason |");
      lines.push("| --- | --- | --- | --- | --- | --- | --- |");
      for (const sym of evidence.symbols) {
        lines.push(
          `| \`${sym.name}\` | \`${sym.kind}\` | \`${sym.filePath}\` | L${sym.startLine}-L${sym.endLine} | \`${sym.confidence}\` | ${sym.referenceCount} | ${sym.discoveryReason.replace(/\|/g, "\\|")} |`,
        );
      }
    }
    lines.push("");

    // Section 4: Repository Architecture
    lines.push("## Repository Architecture");
    if (evidence.relationships.length === 0) {
      lines.push("_No direct inter-module relationships recorded for candidate symbols._");
    } else {
      lines.push("Discovered relationships between candidate files and callers:");
      lines.push("");
      for (const rel of evidence.relationships) {
        lines.push(`- \`${rel.from}\` **${rel.type}** \`${rel.to}\`${rel.context ? ` (${rel.context})` : ""}`);
      }
    }
    lines.push("");

    // Section 5: Historical Intent
    lines.push("## Historical Intent");
    if (evidence.provenance.length === 0) {
      lines.push("_No Git commit provenance recorded._");
    } else {
      for (const prov of evidence.provenance) {
        lines.push(`### \`${prov.symbolName}\` (\`${prov.filePath}\`)`);
        lines.push(`- **Introduction Confidence**: \`${prov.introductionConfidence}\``);
        lines.push(`- **Evidence**: ${prov.introductionEvidence}`);
        if (prov.probableIntroducingCommit) {
          const c = prov.probableIntroducingCommit;
          const prStr = c.associatedPR ? ` (PR [#${c.associatedPR.number}](${c.associatedPR.url}))` : "";
          lines.push(`- **Probable Introducing Commit**: \`${c.shortSha}\` by ${c.author} on ${c.date}${prStr}`);
          lines.push(`  - Message: "${c.message}"`);
        }
        if (prov.recentModifyingCommits.length > 0) {
          lines.push("- **Recent Modifying Commits**:");
          for (const mc of prov.recentModifyingCommits) {
            lines.push(`  - \`${mc.shortSha}\` (${mc.date}) ${mc.author}: "${mc.message}"`);
          }
        }
        lines.push("");
      }
    }

    // Section 6: Likely Implementation Surface
    lines.push("## Likely Implementation Surface");
    if (brief.implementationSurface.length === 0) {
      lines.push("_No specific implementation surface could be confirmed from available evidence._");
    } else {
      for (const item of brief.implementationSurface) {
        lines.push(`### [${item.confidence}] ${item.claim}`);
        lines.push("**Evidence:**");
        for (const ev of item.evidence) {
          lines.push(`- ${ev}`);
        }
        lines.push("");
      }
    }

    // Section 7: Existing Patterns To Reuse
    lines.push("## Existing Patterns To Reuse");
    if (brief.existingPatterns.length === 0) {
      lines.push("_No existing abstractions or patterns identified for reuse._");
    } else {
      for (const pat of brief.existingPatterns) {
        lines.push(`- ${pat}`);
      }
    }
    lines.push("");

    // Section 8: Impact Profile
    lines.push("## Impact Profile");
    lines.push(`- **Overall Impact**: \`${evidence.impactProfile.overallImpact.level}\``);
    lines.push(`  - Rationale: ${evidence.impactProfile.overallImpact.rationale}`);
    lines.push(`- **Reference Fan-Out**: \`${evidence.impactProfile.referenceFanOut.level}\` (${evidence.impactProfile.referenceFanOut.evidence})`);
    lines.push(`- **Historical Churn**: \`${evidence.impactProfile.historicalChurn.level}\` (${evidence.impactProfile.historicalChurn.evidence})`);
    lines.push(`- **Validation Surface**: \`${evidence.impactProfile.validationSurface.level}\` (${evidence.impactProfile.validationSurface.evidence})`);
    lines.push("");
    lines.push("> *Note: Validation Surface reflects test file existence and reference evidence, NOT percentage line coverage.*");
    lines.push("");

    // Section 9: Validation Strategy
    lines.push("## Validation Strategy");
    lines.push("### Relevant Existing Tests");
    if (brief.validationStrategy.existingTests.length === 0) {
      lines.push("- _No existing tests identified for these symbols._");
    } else {
      for (const t of brief.validationStrategy.existingTests) {
        lines.push(`- \`${t}\``);
      }
    }
    lines.push("");
    lines.push("### Suggested Test Scenarios");
    for (const sc of brief.validationStrategy.suggestedScenarios) {
      lines.push(`- ${sc}`);
    }
    lines.push("");

    // Section 10: Confidence & Evidence
    lines.push("## Confidence & Evidence");
    lines.push("### High Confidence");
    for (const hc of brief.confidenceSections.highConfidence) {
      lines.push(`- ${hc}`);
    }
    lines.push("");
    lines.push("### Medium Confidence");
    for (const mc of brief.confidenceSections.mediumConfidence) {
      lines.push(`- ${mc}`);
    }
    lines.push("");
    lines.push("### Uncertain / Open Questions");
    for (const uc of brief.confidenceSections.uncertainOpenQuestions) {
      lines.push(`- ${uc}`);
    }
    lines.push("");

    // Section 11: Limitations
    lines.push("## Limitations");
    if (brief.limitations.length === 0) {
      lines.push("- No analyzer limitations were recorded.");
    } else {
      for (const lim of brief.limitations) {
        lines.push(`- ${lim}`);
      }
    }
    lines.push("");

    // Section 12: Evidence Index
    lines.push("## Evidence Index");
    lines.push(`- **Repository Remote**: ${evidence.repository.remote}`);
    lines.push(`- **Current HEAD Commit**: \`${evidence.repository.currentCommit}\``);
    lines.push(`- **Issue URL**: ${evidence.issue.url}`);
    lines.push("- **Indexed Symbols & Locations**:");
    for (const sym of evidence.symbols) {
      lines.push(`  - \`${sym.name}\`: \`${sym.filePath}#L${sym.startLine}-L${sym.endLine}\``);
    }
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Writes the generated report to disk at outputPath.
   */
  writeToFile(
    evidence: EvidenceGraph,
    brief: ContributorBrief,
    outputPath: string,
    rootDir: string = process.cwd(),
  ): string {
    const fullPath = path.isAbsolute(outputPath) ? outputPath : path.join(rootDir, outputPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = this.generate(evidence, brief);
    fs.writeFileSync(fullPath, content, "utf-8");
    return normalizePath(fullPath);
  }
}
