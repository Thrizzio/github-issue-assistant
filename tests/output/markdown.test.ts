import { describe, expect, it } from "vitest";
import { EvidenceGraph } from "../../src/evidence/schema.js";
import { MarkdownReportGenerator } from "../../src/output/markdown.js";
import { ContributorBrief } from "../../src/synthesis/schema.js";

describe("MarkdownReportGenerator", () => {
  const sampleGraph: EvidenceGraph = {
    version: "1.0.0",
    generatedAt: "2025-01-01T00:00:00Z",
    issue: {
      id: 1842,
      number: 1842,
      title: "Add retry support to GitHub API client",
      body: "Need retry logic on 429 status code.",
      state: "open",
      author: "alice",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      labels: ["enhancement"],
      comments: [],
      url: "https://github.com/trpc/trpc/issues/1842",
      extractedKeywords: ["retry"],
      mentionedSymbols: [],
    },
    repository: {
      owner: "trpc",
      name: "trpc",
      remote: "https://github.com/trpc/trpc.git",
      currentCommit: "7a31c2def",
      rootDir: "/workspace/trpc",
    },
    symbols: [
      {
        name: "RequestExecutor",
        kind: "class",
        filePath: "src/api/request.ts",
        startLine: 10,
        endLine: 40,
        isExported: true,
        confidence: "HIGH",
        discoveryReason: "Exact identifier match",
        referenceCount: 37,
        referencingFiles: ["src/api/client.ts"],
        references: [],
      },
    ],
    relationships: [],
    provenance: [],
    validationSurface: {
      directTests: [{ testFile: "tests/api/request.test.ts", matchedReason: "Direct test" }],
      callerTests: [],
      level: "LOW",
      explanation: "Low validation surface",
    },
    impactProfile: {
      referenceFanOut: { level: "HIGH", evidence: "37 references" },
      historicalChurn: { level: "MEDIUM", evidence: "5 commits" },
      validationSurface: { level: "LOW", evidence: "Low validation surface" },
      overallImpact: { level: "HIGH", rationale: "Wide reference fan-out" },
    },
    limitations: ["No tsconfig found, used default options"],
  };

  const sampleBrief: ContributorBrief = {
    observedProblem: "The issue describes a need for retry logic on 429 rate limit responses.",
    historicalIntent: "RequestExecutor was created in commit 7a31c2def.",
    implementationSurface: [
      {
        claim: "Retry handling likely belongs in RequestExecutor.",
        confidence: "HIGH",
        evidence: ["Symbol: RequestExecutor", "File: src/api/request.ts:10"],
      },
    ],
    existingPatterns: ["RequestExecutor handles HTTP execution"],
    validationStrategy: {
      existingTests: ["tests/api/request.test.ts"],
      suggestedScenarios: ["Test exponential backoff on 429 response"],
    },
    confidenceSections: {
      highConfidence: ["RequestExecutor has 37 references"],
      mediumConfidence: ["RequestExecutor is the likely surface"],
      uncertainOpenQuestions: ["Retry-After header handling was not specified in the issue"],
    },
    openQuestions: ["Should retries use exponential backoff or fixed delay?"],
    limitations: ["Deterministic analysis only"],
  };

  it("generates markdown containing all required sections from Section 29", () => {
    const generator = new MarkdownReportGenerator();
    const md = generator.generate(sampleGraph, sampleBrief);

    // Verify required sections
    expect(md).toContain("# Contributor Context");
    expect(md).toContain("## Issue");
    expect(md).toContain("## Observed Problem");
    expect(md).toContain("## Evidence Summary");
    expect(md).toContain("## Repository Architecture");
    expect(md).toContain("## Historical Intent");
    expect(md).toContain("## Likely Implementation Surface");
    expect(md).toContain("## Existing Patterns To Reuse");
    expect(md).toContain("## Impact Profile");
    expect(md).toContain("## Validation Strategy");
    expect(md).toContain("## Confidence & Evidence");
    expect(md).toContain("### High Confidence");
    expect(md).toContain("### Medium Confidence");
    expect(md).toContain("### Uncertain / Open Questions");
    expect(md).toContain("## Limitations");
    expect(md).toContain("## Evidence Index");

    // Verify specific content
    expect(md).toContain("RequestExecutor");
    expect(md).toContain("src/api/request.ts");
    expect(md).toContain("tests/api/request.test.ts");
    expect(md).toContain("Issue #1842");
  });
});
