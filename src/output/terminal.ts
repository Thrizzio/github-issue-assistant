import chalk from "chalk";
import { EvidenceGraph } from "../evidence/schema.js";

export function formatTerminalSummary(
  evidence: EvidenceGraph,
  outputPath: string,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan("IssuePilot ── Contributor Reconnaissance"));
  lines.push("");

  // Issue Header
  lines.push(
    chalk.bold.yellow(`Issue #${evidence.issue.number}`) +
      " " +
      chalk.bold.white(evidence.issue.title),
  );
  lines.push("");

  // Archaeology
  lines.push(chalk.bold("Archaeology"));
  if (evidence.symbols.length > 0) {
    const primarySym = evidence.symbols[0];
    const prov = evidence.provenance.find((p) => p.symbolName === primarySym.name);

    lines.push(`  Primary Symbol:   ${chalk.cyan(primarySym.name)}`);
    lines.push(`  Location:         ${chalk.gray(`${primarySym.filePath}:${primarySym.startLine}`)}`);
    if (prov?.probableIntroducingCommit) {
      lines.push(
        `  Probable Origin:  ${chalk.green(prov.probableIntroducingCommit.shortSha)} (${prov.probableIntroducingCommit.date})`,
      );
    }
    lines.push(
      `  References:       ${chalk.white(primarySym.referenceCount)} across ${primarySym.referencingFiles.length} file(s)`,
    );
  } else {
    lines.push(chalk.gray("  No candidate symbols located."));
  }
  lines.push("");

  // Impact Profile
  const colorLevel = (level: "LOW" | "MEDIUM" | "HIGH") => {
    switch (level) {
      case "HIGH":
        return chalk.bold.red(level);
      case "MEDIUM":
        return chalk.bold.yellow(level);
      case "LOW":
        return chalk.bold.green(level);
    }
  };

  lines.push(chalk.bold("Impact Profile"));
  lines.push(`  Fan-out:            ${colorLevel(evidence.impactProfile.referenceFanOut.level)}`);
  lines.push(`  Churn:               ${colorLevel(evidence.impactProfile.historicalChurn.level)}`);
  lines.push(`  Validation Surface:  ${colorLevel(evidence.impactProfile.validationSurface.level)}`);
  lines.push(`  Overall Impact:      ${colorLevel(evidence.impactProfile.overallImpact.level)}`);
  lines.push("");

  // Tests
  lines.push(chalk.bold("Tests"));
  const allTests = [
    ...evidence.validationSurface.directTests.map((t) => t.testFile),
    ...evidence.validationSurface.callerTests.map((t) => t.testFile),
  ];
  if (allTests.length === 0) {
    lines.push(chalk.gray("  (None found)"));
  } else {
    for (const tf of Array.from(new Set(allTests)).slice(0, 5)) {
      lines.push(`  ${chalk.cyan(tf)}`);
    }
  }
  lines.push("");

  // Output
  lines.push(chalk.bold("Output"));
  lines.push(`  ${chalk.green("✓")} ${chalk.underline(outputPath)}`);
  lines.push("");

  return lines.join("\n");
}
