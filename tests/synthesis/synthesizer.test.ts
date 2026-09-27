import { describe, expect, it } from "vitest";
import { EvidenceGraph } from "../../src/evidence/schema.js";
import { LLMProvider } from "../../src/synthesis/provider.js";
import { ContributorBrief } from "../../src/synthesis/schema.js";
import { Synthesizer } from "../../src/synthesis/synthesizer.js";

describe("Synthesizer", () => {
  const minimalGraph: EvidenceGraph = {
    version: "1.0.0",
    generatedAt: "2025-01-01T00:00:00Z",
    issue: {
      id: 100,
      number: 100,
      title: "Test Issue",
      body: "Sample issue body",
      state: "open",
      author: "tester",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      labels: [],
      comments: [],
      url: "https://github.com/foo/bar/issues/100",
      extractedKeywords: [],
      mentionedSymbols: [],
    },
    repository: {
      owner: "foo",
      name: "bar",
      remote: "https://github.com/foo/bar.git",
      currentCommit: "abcdef1",
      rootDir: "/workspace",
    },
    symbols: [],
    relationships: [],
    provenance: [],
    validationSurface: {
      directTests: [],
      callerTests: [],
      level: "LOW",
      explanation: "No tests found",
    },
    impactProfile: {
      referenceFanOut: { level: "LOW", evidence: "0 refs" },
      historicalChurn: { level: "LOW", evidence: "0 commits" },
      validationSurface: { level: "LOW", evidence: "No tests" },
      overallImpact: { level: "LOW", rationale: "Isolated" },
    },
    limitations: [],
  };

  it("produces deterministic brief when --no-llm is specified", async () => {
    const synthesizer = new Synthesizer();
    const result = await synthesizer.synthesize(minimalGraph, { noLlm: true });

    expect(result.usedLLM).toBe(false);
    expect(result.brief).toBeDefined();
    expect(result.brief.observedProblem).toContain("Issue #100: Test Issue");
    expect(result.brief.limitations.some((l) => l.includes("--no-llm"))).toBe(true);
  });

  it("falls back gracefully to deterministic brief when no LLM provider is configured", async () => {
    const synthesizer = new Synthesizer();
    // Default environment without API keys
    const result = await synthesizer.synthesize(minimalGraph);

    expect(result.usedLLM).toBe(false);
    expect(result.brief).toBeDefined();
    expect(result.brief.observedProblem).toContain("Issue #100: Test Issue");
  });

  it("uses custom LLM provider when provided and succeeds", async () => {
    const customBrief: ContributorBrief = {
      observedProblem: "Synthesized problem",
      historicalIntent: "Synthesized intent",
      implementationSurface: [],
      existingPatterns: [],
      validationStrategy: { existingTests: [], suggestedScenarios: [] },
      confidenceSections: { highConfidence: [], mediumConfidence: [], uncertainOpenQuestions: [] },
      openQuestions: [],
      limitations: [],
    };

    const mockProvider: LLMProvider = {
      name: "mock-llm",
      isConfigured: () => true,
      generateContributorBrief: async () => customBrief,
    };

    const synthesizer = new Synthesizer();
    const result = await synthesizer.synthesize(minimalGraph, {
      customProvider: mockProvider,
    });

    expect(result.usedLLM).toBe(true);
    expect(result.providerName).toBe("mock-llm");
    expect(result.brief.observedProblem).toBe("Synthesized problem");
  });

  it("falls back to deterministic brief if custom LLM provider fails", async () => {
    const failingProvider: LLMProvider = {
      name: "failing-llm",
      isConfigured: () => true,
      generateContributorBrief: async () => {
        throw new Error("API rate limit exceeded");
      },
    };

    const synthesizer = new Synthesizer();
    const result = await synthesizer.synthesize(minimalGraph, {
      customProvider: failingProvider,
    });

    expect(result.usedLLM).toBe(false);
    expect(result.brief).toBeDefined();
    expect(result.fallbackReason).toContain("API rate limit exceeded");
  });
});
