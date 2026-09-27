import { describe, expect, it } from "vitest";
import { EvidenceGraph } from "../../src/evidence/schema.js";
import { EvidenceValidator } from "../../src/evidence/validator.js";

describe("EvidenceValidator", () => {
  const validGraph: EvidenceGraph = {
    version: "1.0.0",
    generatedAt: "2025-01-01T00:00:00Z",
    issue: {
      id: 1842,
      number: 1842,
      title: "Add retry support to GitHub API client",
      body: "Please add retry capability to RequestExecutor.",
      state: "open",
      author: "alice",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      labels: ["enhancement"],
      comments: [
        {
          id: 101,
          author: "bob",
          body: "Consider exponential backoff.",
          createdAt: "2025-01-02T00:00:00Z",
        },
      ],
      url: "https://github.com/trpc/trpc/issues/1842",
      extractedKeywords: ["retry", "backoff"],
      mentionedSymbols: [
        {
          name: "RequestExecutor",
          confidence: "HIGH",
          reason: "Found in issue body",
          source: "body",
          kindHint: "class",
        },
      ],
    },
    repository: {
      owner: "trpc",
      name: "trpc",
      remote: "https://github.com/trpc/trpc.git",
      currentCommit: "7a31c2def89a1",
      rootDir: "/workspace/trpc",
    },
    symbols: [
      {
        name: "RequestExecutor",
        kind: "class",
        filePath: "src/api/request.ts",
        startLine: 10,
        endLine: 50,
        isExported: true,
        confidence: "HIGH",
        discoveryReason: "Exact identifier match",
        referenceCount: 4,
        referencingFiles: ["src/api/client.ts"],
        references: [
          {
            sourceFile: "src/api/client.ts",
            line: 12,
            column: 5,
            symbolName: "RequestExecutor",
            referenceType: "call",
          },
        ],
      },
    ],
    relationships: [
      {
        from: "src/api/client.ts",
        to: "src/api/request.ts:RequestExecutor",
        type: "calls",
      },
    ],
    provenance: [
      {
        symbolName: "RequestExecutor",
        filePath: "src/api/request.ts",
        probableIntroducingCommit: {
          sha: "7a31c2def89a1",
          shortSha: "7a31c2d",
          author: "Alice",
          date: "2024-06-01T00:00:00Z",
          message: "initial request executor",
        },
        introductionConfidence: "MEDIUM_CONFIDENCE",
        introductionEvidence: "git log -S match",
        recentModifyingCommits: [],
      },
    ],
    validationSurface: {
      directTests: [
        {
          testFile: "tests/api/request.test.ts",
          matchedReason: "Direct reference",
        },
      ],
      callerTests: [],
      level: "MEDIUM",
      explanation: "Direct test exists",
    },
    impactProfile: {
      referenceFanOut: {
        level: "LOW",
        evidence: "4 references",
      },
      historicalChurn: {
        level: "LOW",
        evidence: "1 commit",
      },
      validationSurface: {
        level: "MEDIUM",
        evidence: "Direct test exists",
      },
      overallImpact: {
        level: "LOW",
        rationale: "Isolated symbol",
      },
    },
    limitations: [],
  };

  it("validates a conforming EvidenceGraph successfully", () => {
    const res = EvidenceValidator.validate(validGraph);
    expect(res.valid).toBe(true);
    expect(res.graph).toBeDefined();
  });

  it("rejects an EvidenceGraph with missing required fields", () => {
    const incomplete = { ...validGraph, repository: undefined };
    const res = EvidenceValidator.validate(incomplete);
    expect(res.valid).toBe(false);
    expect(res.errors && res.errors.length > 0).toBe(true);
  });
});
