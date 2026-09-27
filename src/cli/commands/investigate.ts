import ora from "ora";
import path from "node:path";
import { ChurnAnalyzer } from "../../archaeology/churn.js";
import { GitClient } from "../../archaeology/git.js";
import { ProvenanceAnalyzer } from "../../archaeology/provenance.js";
import { loadConfig } from "../../config/config.js";
import { EvidenceGraphBuilder } from "../../evidence/builder.js";
import { GitHubClient } from "../../github/client.js";
import { GitHubIssueService } from "../../github/issue.js";
import { PullRequestService } from "../../github/pullRequests.js";
import { ImpactProfiler } from "../../impact/profile.js";
import { MarkdownReportGenerator } from "../../output/markdown.js";
import { formatTerminalSummary } from "../../output/terminal.js";
import { RepositoryDetector } from "../../repository/detector.js";
import { FileDiscovery } from "../../repository/fileDiscovery.js";
import { TsMorphProjectManager } from "../../repository/project.js";
import { ReferenceAnalyzer } from "../../repository/references.js";
import { SymbolDiscovery } from "../../repository/symbols.js";
import { TestDiscovery } from "../../repository/tests.js";
import { Synthesizer } from "../../synthesis/synthesizer.js";
import { CliError, IssuePilotError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { toRelativePath } from "../../utils/paths.js";

export interface InvestigateCommandOptions {
  repo?: string;
  token?: string;
  noLlm?: boolean;
  output?: string;
  json?: boolean;
  verbose?: boolean;
  cwd?: string;
}

export async function runInvestigate(
  issueNumberStr: string,
  options: InvestigateCommandOptions,
): Promise<void> {
  const rootDir = options.cwd ?? process.cwd();
  if (options.verbose) {
    logger.setVerbose(true);
  }
  if (options.json) {
    logger.setSilent(true);
  }

  const issueNumber = parseInt(issueNumberStr, 10);
  if (isNaN(issueNumber) || issueNumber <= 0) {
    throw new CliError(`Invalid issue number: "${issueNumberStr}". Must be a positive integer.`);
  }

  const config = loadConfig(rootDir);
  const outputPath = options.output || config.output.path;

  const spinner = ora({
    isSilent: options.json || options.verbose,
  });

  try {
    // 1. Repository and remote detection
    spinner.start("Detecting Git repository and remote...");
    const git = new GitClient(rootDir);
    const detector = new RepositoryDetector(git);
    const repoCoords = await detector.detect(rootDir, options.repo);
    spinner.succeed(
      `Detected repository ${repoCoords.owner}/${repoCoords.name} (HEAD: ${repoCoords.currentCommit.slice(0, 7)})`,
    );

    // 2. Fetch GitHub issue and comments
    spinner.start(`Fetching GitHub issue #${issueNumber} from ${repoCoords.owner}/${repoCoords.name}...`);
    const ghClient = new GitHubClient({ token: options.token });
    const issueService = new GitHubIssueService(ghClient);
    const prService = new PullRequestService(ghClient);
    const issueEvidence = await issueService.fetchIssueEvidence(
      repoCoords.owner,
      repoCoords.name,
      issueNumber,
    );
    spinner.succeed(
      `Fetched issue #${issueNumber}: "${issueEvidence.title}" (${issueEvidence.comments.length} comments, ${issueEvidence.extractedCandidates.length} candidate terms)`,
    );

    // 3. File discovery
    spinner.start("Indexing repository source files...");
    const fileDiscovery = new FileDiscovery(rootDir);
    const inventory = fileDiscovery.discover();
    spinner.succeed(
      `Indexed ${inventory.sourceFiles.length} source file(s) and ${inventory.testFiles.length} test file(s)`,
    );

    // 4. Initialize ts-morph project
    spinner.start("Loading TypeScript AST project...");
    const projectManager = new TsMorphProjectManager(rootDir);
    const initResult = projectManager.initialize(inventory);
    spinner.succeed(
      `TypeScript AST loaded (${initResult.hasTsConfig ? "tsconfig.json" : "fallback options"}, ${initResult.limitations.length} diagnostic limitations)`,
    );

    // 5. Symbol discovery
    spinner.start("Locating candidate symbols in AST...");
    const symbolDiscovery = new SymbolDiscovery(initResult.project, rootDir);
    const discoveredSymbols = symbolDiscovery.findCandidateSymbols(
      issueEvidence.extractedCandidates,
      config.analysis.maxRelevantSymbols,
    );
    spinner.succeed(`Discovered ${discoveredSymbols.length} candidate symbol(s)`);

    // 6. Semantic references and call sites
    spinner.start("Resolving semantic references and call sites...");
    const refAnalyzer = new ReferenceAnalyzer(rootDir);
    const { summaries: refSummaries, relationships } = refAnalyzer.findReferences(
      discoveredSymbols,
      (w) => logger.debug(w),
    );
    let totalRefCount = 0;
    for (const s of refSummaries.values()) {
      totalRefCount += s.fanOutCount;
    }
    spinner.succeed(`Resolved ${totalRefCount} semantic reference(s) across codebase`);

    // 7. Test discovery
    spinner.start("Analyzing validation surface and test coverage...");
    const testDiscovery = new TestDiscovery();
    const validationSurface = testDiscovery.discoverTests(
      inventory.testFiles,
      discoveredSymbols,
      refSummaries,
    );
    spinner.succeed(
      `Validation surface: ${validationSurface.level} (${validationSurface.directTests.length} direct, ${validationSurface.callerTests.length} caller tests)`,
    );

    // 8. Git archaeology & provenance
    spinner.start("Investigating Git archaeology and symbol provenance...");
    const provenanceAnalyzer = new ProvenanceAnalyzer(
      git,
      prService,
      repoCoords.owner,
      repoCoords.name,
    );
    const provenanceResults = await Promise.all(
      discoveredSymbols.slice(0, 5).map((sym) => provenanceAnalyzer.analyzeSymbolProvenance(sym)),
    );

    const relevantFiles = Array.from(
      new Set(discoveredSymbols.map((s) => s.filePath)),
    );
    const churnAnalyzer = new ChurnAnalyzer(git);
    const churnReport = await churnAnalyzer.calculateChurn(
      relevantFiles,
      config.analysis.churnMonths,
    );
    spinner.succeed(
      `Archaeology complete: ${provenanceResults.length} provenance trail(s), ${churnReport.totalCommits} churn commit(s)`,
    );

    // 9. Impact Profiling
    spinner.start("Calculating impact profile...");
    const impactProfiler = new ImpactProfiler();
    const impactProfile = impactProfiler.calculateProfile(
      refSummaries,
      churnReport,
      validationSurface,
    );
    spinner.succeed(`Overall Impact calculated: ${impactProfile.overallImpact.level}`);

    // 10. Construct EvidenceGraph
    spinner.start("Building EvidenceGraph...");
    const evidenceGraph = EvidenceGraphBuilder.build({
      issue: issueEvidence,
      repo: repoCoords,
      symbols: discoveredSymbols,
      referenceSummaries: refSummaries,
      relationships,
      provenance: provenanceResults,
      validationSurface,
      impactProfile,
      limitations: initResult.limitations,
    });

    const serializedJsonPath = EvidenceGraphBuilder.serializeToFile(evidenceGraph, rootDir);
    spinner.succeed(`EvidenceGraph serialized: ${toRelativePath(rootDir, serializedJsonPath)}`);

    // 11. LLM Synthesis or deterministic fallback
    spinner.start(options.noLlm ? "Generating deterministic contributor brief..." : "Synthesizing contributor brief...");
    const synthesizer = new Synthesizer();
    const synthesisResult = await synthesizer.synthesize(evidenceGraph, {
      noLlm: options.noLlm,
      providerName: config.llm.provider,
    });
    spinner.succeed(
      synthesisResult.usedLLM
        ? `Brief synthesized via LLM (${synthesisResult.providerName})`
        : `Deterministic brief compiled (${synthesisResult.fallbackReason || "deterministic mode"})`,
    );

    // 12. Markdown report generation
    spinner.start("Writing markdown report...");
    const reportGen = new MarkdownReportGenerator();
    const generatedReportPath = reportGen.writeToFile(
      evidenceGraph,
      synthesisResult.brief,
      outputPath,
      rootDir,
    );
    const relReportPath = toRelativePath(rootDir, generatedReportPath);
    spinner.succeed(`Report written: ${relReportPath}`);

    // 13. Output presentation
    if (options.json) {
      console.log(JSON.stringify(evidenceGraph, null, 2));
    } else {
      const summaryText = formatTerminalSummary(evidenceGraph, relReportPath);
      console.log(summaryText);
    }
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof IssuePilotError) {
      logger.error(err.message);
      if (options.verbose && err.details) {
        logger.error("Details:", err.details);
      }
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Investigation failed: ${msg}`, err);
    }
    process.exitCode = 1;
  }
}
