import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChurnAnalyzer } from "../../src/archaeology/churn.js";
import { GitClient } from "../../src/archaeology/git.js";
import { ProvenanceAnalyzer } from "../../src/archaeology/provenance.js";
import { EvidenceGraphBuilder } from "../../src/evidence/builder.js";
import { EvidenceValidator } from "../../src/evidence/validator.js";
import { extractIssueCandidates, IssueEvidence } from "../../src/github/issue.js";
import { ImpactProfiler } from "../../src/impact/profile.js";
import { MarkdownReportGenerator } from "../../src/output/markdown.js";
import { RepositoryDetector } from "../../src/repository/detector.js";
import { FileDiscovery } from "../../src/repository/fileDiscovery.js";
import { TsMorphProjectManager } from "../../src/repository/project.js";
import { ReferenceAnalyzer } from "../../src/repository/references.js";
import { SymbolDiscovery } from "../../src/repository/symbols.js";
import { TestDiscovery } from "../../src/repository/tests.js";
import { Synthesizer } from "../../src/synthesis/synthesizer.js";
import { createFixtureRepository, FixtureRepo } from "../fixtures/setupFixtureRepo.js";

describe("IssuePilot End-to-End Archaeology Pipeline", () => {
  let fixture: FixtureRepo;

  beforeAll(() => {
    fixture = createFixtureRepository();
  });

  afterAll(() => {
    fixture.cleanup();
  });

  it("successfully performs full reconnaissance against test repository fixture", async () => {
    const rootDir = fixture.rootDir;
    const git = new GitClient(rootDir);

    // 1. Detect repository and remote
    const detector = new RepositoryDetector(git);
    const repoCoords = await detector.detect(rootDir);
    expect(repoCoords.owner).toBe("trpc");
    expect(repoCoords.name).toBe("trpc");
    expect(repoCoords.currentCommit).toMatch(/^[a-f0-9]{40}$/);

    // 2. Mock GitHub Issue with realistic problem statement
    const issueTitle = "Add retry on rate limit in RequestExecutor";
    const issueBody =
      "When calling `RequestExecutor.execute()`, we should retry 3 times on network failure. See `src/api/request.ts`.";
    const candidates = extractIssueCandidates(issueTitle, issueBody);

    const mockIssue: IssueEvidence = {
      number: 1842,
      title: issueTitle,
      body: issueBody,
      state: "open",
      author: "contributor1",
      createdAt: "2025-01-01T12:00:00Z",
      updatedAt: "2025-01-02T12:00:00Z",
      labels: ["feature"],
      comments: [
        {
          id: 1,
          author: "maintainer",
          body: "Ensure existing callers like `ApiClient` and `AuthHandler` are tested.",
          createdAt: "2025-01-02T13:00:00Z",
        },
      ],
      url: "https://github.com/trpc/trpc/issues/1842",
      extractedCandidates: candidates,
    };

    // 3. Discover source files
    const fileDiscovery = new FileDiscovery(rootDir);
    const inventory = fileDiscovery.discover();
    expect(inventory.sourceFiles.some((f) => f.includes("src/api/request.ts"))).toBe(true);
    expect(inventory.testFiles.some((f) => f.includes("tests/api/request.test.ts"))).toBe(true);

    // 4. Initialize ts-morph AST project
    const projectManager = new TsMorphProjectManager(rootDir);
    const projectInit = projectManager.initialize(inventory);
    expect(projectInit.project).toBeDefined();

    // 5. Discover symbols
    const symbolDiscovery = new SymbolDiscovery(projectInit.project, rootDir);
    const symbols = symbolDiscovery.findCandidateSymbols(mockIssue.extractedCandidates, 10);

    const reqExecutor = symbols.find((s) => s.name === "RequestExecutor");
    expect(reqExecutor).toBeDefined();
    expect(reqExecutor?.filePath).toBe("src/api/request.ts");
    expect(reqExecutor?.kind).toBe("class");
    expect(reqExecutor?.isExported).toBe(true);

    const executeMethod = symbols.find((s) => s.name === "execute");
    expect(executeMethod).toBeDefined();
    expect(executeMethod?.filePath).toBe("src/api/request.ts");

    // 6. Resolve semantic references
    const refAnalyzer = new ReferenceAnalyzer(rootDir);
    const { summaries: refSummaries, relationships } = refAnalyzer.findReferences(symbols);

    const reqSummary = refSummaries.get("src/api/request.ts:RequestExecutor");
    expect(reqSummary).toBeDefined();
    expect(reqSummary!.fanOutCount).toBeGreaterThanOrEqual(3);
    expect(reqSummary!.referencingFiles.some((f) => f.includes("client.ts"))).toBe(true);
    expect(reqSummary!.referencingFiles.some((f) => f.includes("auth.ts"))).toBe(true);
    expect(reqSummary!.referencingFiles.some((f) => f.includes("request.test.ts"))).toBe(true);

    // 7. Test discovery
    const testDiscovery = new TestDiscovery();
    const validationSurface = testDiscovery.discoverTests(
      inventory.testFiles,
      symbols,
      refSummaries,
    );
    expect(validationSurface.directTests.length).toBeGreaterThanOrEqual(1);
    expect(validationSurface.directTests.some((t) => t.testFile.includes("request.test.ts"))).toBe(
      true,
    );

    // 8. Provenance and archaeology
    const provenanceAnalyzer = new ProvenanceAnalyzer(git);
    const provenanceResults = await Promise.all(
      symbols.map((sym) => provenanceAnalyzer.analyzeSymbolProvenance(sym)),
    );

    const reqProv = provenanceResults.find((p) => p.symbolName === "RequestExecutor");
    expect(reqProv).toBeDefined();
    expect(reqProv?.probableIntroducingCommit).toBeDefined();
    expect(reqProv?.probableIntroducingCommit?.message).toContain(
      "initial implementation of RequestExecutor",
    );

    const relevantFiles = Array.from(new Set(symbols.map((s) => s.filePath)));
    const churnAnalyzer = new ChurnAnalyzer(git);
    const churnReport = await churnAnalyzer.calculateChurn(relevantFiles, 6);
    expect(churnReport.totalCommits).toBeGreaterThanOrEqual(2);

    // 9. Impact profile
    const impactProfiler = new ImpactProfiler();
    const impactProfile = impactProfiler.calculateProfile(
      refSummaries,
      churnReport,
      validationSurface,
    );
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(impactProfile.overallImpact.level);

    // 10. Construct EvidenceGraph & validate
    const evidenceGraph = EvidenceGraphBuilder.build({
      issue: mockIssue,
      repo: repoCoords,
      symbols,
      referenceSummaries: refSummaries,
      relationships,
      provenance: provenanceResults,
      validationSurface,
      impactProfile,
      limitations: projectInit.limitations,
    });

    const validation = EvidenceValidator.validate(evidenceGraph);
    expect(validation.valid).toBe(true);

    // Check JSON serialization
    const jsonPath = EvidenceGraphBuilder.serializeToFile(evidenceGraph, rootDir);
    expect(fs.existsSync(jsonPath)).toBe(true);
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    expect(jsonContent.issue.number).toBe(1842);
    expect(jsonContent.symbols.length).toBeGreaterThanOrEqual(1);

    // 11. Synthesis in deterministic mode (--no-llm)
    const synthesizer = new Synthesizer();
    const synthesisResult = await synthesizer.synthesize(evidenceGraph, { noLlm: true });
    expect(synthesisResult.usedLLM).toBe(false);
    expect(synthesisResult.brief.observedProblem).toContain(
      "Add retry on rate limit in RequestExecutor",
    );

    // 12. Markdown report generation
    const reportGen = new MarkdownReportGenerator();
    const outputPath = path.join(rootDir, ".github", "CONTRIBUTOR_CONTEXT.md");
    const writtenPath = reportGen.writeToFile(
      evidenceGraph,
      synthesisResult.brief,
      outputPath,
      rootDir,
    );

    expect(fs.existsSync(writtenPath)).toBe(true);
    const markdownContent = fs.readFileSync(writtenPath, "utf-8");

    // Assert key sections and trace evidence
    expect(markdownContent).toContain("# Contributor Context");
    expect(markdownContent).toContain("## Issue");
    expect(markdownContent).toContain("## Observed Problem");
    expect(markdownContent).toContain("## Evidence Summary");
    expect(markdownContent).toContain("## Repository Architecture");
    expect(markdownContent).toContain("## Historical Intent");
    expect(markdownContent).toContain("## Likely Implementation Surface");
    expect(markdownContent).toContain("## Impact Profile");
    expect(markdownContent).toContain("## Validation Strategy");
    expect(markdownContent).toContain("RequestExecutor");
    expect(markdownContent).toContain("src/api/request.ts");
    expect(markdownContent).toContain("tests/api/request.test.ts");
  });
});
