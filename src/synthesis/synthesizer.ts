import { EvidenceGraph } from "../evidence/schema.js";
import { logger } from "../utils/logger.js";
import { getLLMProvider, LLMProvider } from "./provider.js";
import { ContributorBrief } from "./schema.js";

export interface SynthesisOptions {
  noLlm?: boolean;
  providerName?: string;
  customProvider?: LLMProvider;
}

export interface SynthesisResult {
  brief: ContributorBrief;
  usedLLM: boolean;
  providerName?: string;
  fallbackReason?: string;
}

export class Synthesizer {
  /**
   * Generates a contributor brief either via LLM or deterministic fallback.
   */
  async synthesize(
    evidence: EvidenceGraph,
    options?: SynthesisOptions,
  ): Promise<SynthesisResult> {
    if (options?.noLlm) {
      return {
        brief: this.generateDeterministicBrief(
          evidence,
          "LLM synthesis disabled via --no-llm flag; report contains deterministic repository evidence only.",
        ),
        usedLLM: false,
      };
    }

    const provider = options?.customProvider || getLLMProvider(options?.providerName);

    if (!provider || !provider.isConfigured()) {
      const reason =
        "LLM synthesis unavailable (no API key configured for Gemini or OpenAI); report contains deterministic repository evidence only.";
      logger.debug(reason);
      return {
        brief: this.generateDeterministicBrief(evidence, reason),
        usedLLM: false,
        fallbackReason: reason,
      };
    }

    try {
      logger.debug(`Synthesizing brief using ${provider.name} provider...`);
      const brief = await provider.generateContributorBrief(evidence);
      return {
        brief,
        usedLLM: true,
        providerName: provider.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const fallbackReason = `LLM synthesis failed (${msg}); report contains deterministic repository evidence only.`;
      logger.warn(fallbackReason);

      return {
        brief: this.generateDeterministicBrief(evidence, fallbackReason),
        usedLLM: false,
        providerName: provider.name,
        fallbackReason,
      };
    }
  }

  /**
   * Generates a fully deterministic brief directly from EvidenceGraph data.
   */
  generateDeterministicBrief(
    evidence: EvidenceGraph,
    fallbackNotice?: string,
  ): ContributorBrief {
    // 1. Observed problem
    const observedProblem = `Issue #${evidence.issue.number}: ${evidence.issue.title}\n\n` +
      `Reported by @${evidence.issue.author} on ${evidence.issue.createdAt}.\n\n` +
      `Explicit problem description:\n${evidence.issue.body.trim() || "(No issue body provided)"}`;

    // 2. Historical intent
    const historicalLines: string[] = [];
    for (const prov of evidence.provenance) {
      if (prov.probableIntroducingCommit) {
        historicalLines.push(
          `Symbol \`${prov.symbolName}\` in \`${prov.filePath}\`: Probable introducing commit ${prov.probableIntroducingCommit.shortSha} ` +
            `by ${prov.probableIntroducingCommit.author} on ${prov.probableIntroducingCommit.date} ("${prov.probableIntroducingCommit.message}"). ` +
            `${prov.introductionEvidence}`,
        );
      }
    }
    const historicalIntent =
      historicalLines.length > 0
        ? historicalLines.join("\n\n")
        : "No discrete introducing commits identified for candidate symbols.";

    // 3. Implementation surface
    const implementationSurface = evidence.symbols.slice(0, 5).map((sym) => {
      const evidenceItems = [
        `File: ${sym.filePath}:${sym.startLine}-${sym.endLine}`,
        `Kind: ${sym.kind}, Exported: ${sym.isExported}`,
        `Semantic References: ${sym.referenceCount} across ${sym.referencingFiles.length} file(s)`,
      ];

      const prov = evidence.provenance.find((p) => p.symbolName === sym.name);
      if (prov?.probableIntroducingCommit) {
        evidenceItems.push(`Probable Origin: ${prov.probableIntroducingCommit.shortSha}`);
      }

      return {
        claim: `Symbol \`${sym.name}\` in \`${sym.filePath}\` is a primary candidate for implementing or fixing this issue.`,
        confidence: sym.confidence === "HIGH" ? "HIGH" as const : "MEDIUM" as const,
        evidence: evidenceItems,
      };
    });

    // 4. Existing patterns
    const existingPatterns: string[] = [];
    for (const rel of evidence.relationships.slice(0, 10)) {
      existingPatterns.push(`\`${rel.from}\` ${rel.type} \`${rel.to}\`${rel.context ? ` (${rel.context})` : ""}`);
    }

    // 5. Validation strategy
    const existingTests = [
      ...evidence.validationSurface.directTests.map(
        (t) => `${t.testFile} (Direct test: ${t.matchedReason})`,
      ),
      ...evidence.validationSurface.callerTests.map(
        (t) => `${t.testFile} (Caller test: ${t.matchedReason})`,
      ),
    ];

    const suggestedScenarios: string[] = [
      `Add regression tests targeting \`${evidence.symbols[0]?.name ?? "the modified symbol"}\` asserting expected behavior described in issue #${evidence.issue.number}.`,
      "Run existing test suite to ensure callers are not broken by signature or behavioral changes.",
    ];

    // 6. Confidence sections
    const highConfidence: string[] = [
      `Repository: ${evidence.repository.owner}/${evidence.repository.name} at commit ${evidence.repository.currentCommit}`,
      `Issue #${evidence.issue.number} verified with state "${evidence.issue.state}" and ${evidence.issue.comments.length} comment(s)`,
      ...evidence.symbols
        .filter((s) => s.confidence === "HIGH")
        .map((s) => `Verified symbol \`${s.name}\` located at \`${s.filePath}:${s.startLine}\` with ${s.referenceCount} reference(s)`),
    ];

    const mediumConfidence: string[] = [
      ...evidence.symbols
        .filter((s) => s.confidence === "MEDIUM")
        .map((s) => `Candidate symbol \`${s.name}\` identified in \`${s.filePath}\` (${s.discoveryReason})`),
      `Impact assessment: reference fan-out (${evidence.impactProfile.referenceFanOut.level}), churn (${evidence.impactProfile.historicalChurn.level}), validation surface (${evidence.impactProfile.validationSurface.level})`,
    ];

    const uncertainOpenQuestions: string[] = [
      ...evidence.issue.extractedKeywords.slice(0, 5).map((kw) => `Relevance of keyword "${kw}" to final architectural resolution`),
      "Detailed edge cases or breaking change constraints not explicitly specified in the GitHub issue description",
    ];

    const limitations = [...evidence.limitations];
    if (fallbackNotice) {
      limitations.unshift(fallbackNotice);
    }

    return {
      observedProblem,
      historicalIntent,
      implementationSurface,
      existingPatterns,
      validationStrategy: {
        existingTests,
        suggestedScenarios,
      },
      confidenceSections: {
        highConfidence,
        mediumConfidence,
        uncertainOpenQuestions,
      },
      openQuestions: uncertainOpenQuestions,
      limitations,
      providerMetadata: {
        provider: "deterministic",
        synthesizedAt: new Date().toISOString(),
      },
    };
  }
}
