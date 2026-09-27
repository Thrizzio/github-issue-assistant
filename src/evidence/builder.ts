import fs from "node:fs";
import path from "node:path";
import { SymbolProvenance } from "../archaeology/provenance.js";
import { IssueEvidence } from "../github/issue.js";
import { ImpactProfile } from "../impact/profile.js";
import { RepoCoordinates } from "../repository/detector.js";
import { CodeRelationship, SymbolReferenceSummary } from "../repository/references.js";
import { DiscoveredSymbol } from "../repository/symbols.js";
import { ValidationSurface } from "../repository/tests.js";
import { normalizePath } from "../utils/paths.js";
import { EvidenceGraph, EvidenceSymbol } from "./schema.js";
import { EvidenceValidator } from "./validator.js";

export interface EvidenceBuilderInput {
  issue: IssueEvidence;
  repo: RepoCoordinates;
  symbols: DiscoveredSymbol[];
  referenceSummaries: Map<string, SymbolReferenceSummary>;
  relationships: CodeRelationship[];
  provenance: SymbolProvenance[];
  validationSurface: ValidationSurface;
  impactProfile: ImpactProfile;
  limitations: string[];
}

export class EvidenceGraphBuilder {
  /**
   * Constructs, normalizes, and validates the complete EvidenceGraph.
   */
  static build(input: EvidenceBuilderInput): EvidenceGraph {
    const {
      issue,
      repo,
      symbols,
      referenceSummaries,
      relationships,
      provenance,
      validationSurface,
      impactProfile,
      limitations,
    } = input;

    // Map DiscoveredSymbols to EvidenceSymbols with semantic references
    const evidenceSymbols: EvidenceSymbol[] = symbols.map((sym) => {
      const symKey = `${sym.filePath}:${sym.containerName ? `${sym.containerName}.` : ""}${sym.name}`;
      const summary = referenceSummaries.get(symKey);

      return {
        name: sym.name,
        kind: sym.kind,
        filePath: sym.filePath,
        startLine: sym.startLine,
        endLine: sym.endLine,
        isExported: sym.isExported,
        containerName: sym.containerName,
        confidence: sym.confidence,
        discoveryReason: sym.discoveryReason,
        referenceCount: summary ? summary.fanOutCount : 0,
        referencingFiles: summary ? summary.referencingFiles : [],
        references: summary
          ? summary.references.map((r) => ({
              sourceFile: r.sourceFile,
              line: r.line,
              column: r.column,
              symbolName: r.symbolName,
              referenceType: r.referenceType,
              snippet: r.snippet,
            }))
          : [],
      };
    });

    const graph: EvidenceGraph = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      issue: {
        id: issue.number, // normalized ID
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author: issue.author,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        labels: issue.labels,
        comments: issue.comments.map((c) => ({
          id: c.id,
          author: c.author,
          body: c.body,
          createdAt: c.createdAt,
        })),
        url: issue.url,
        extractedKeywords: issue.extractedCandidates
          .filter((c) => c.kindHint === "keyword")
          .map((c) => c.name),
        mentionedSymbols: issue.extractedCandidates.map((c) => ({
          name: c.name,
          confidence: c.confidence,
          reason: c.reason,
          source: c.source,
          kindHint: c.kindHint,
        })),
      },
      repository: {
        owner: repo.owner,
        name: repo.name,
        remote: repo.remoteUrl,
        currentCommit: repo.currentCommit,
        rootDir: repo.rootDir,
      },
      symbols: evidenceSymbols,
      relationships: relationships.map((r) => ({
        from: r.from,
        to: r.to,
        type: r.type,
        context: r.context,
      })),
      provenance: provenance.map((p) => ({
        symbolName: p.symbolName,
        filePath: p.filePath,
        probableIntroducingCommit: p.probableIntroducingCommit
          ? {
              sha: p.probableIntroducingCommit.sha,
              shortSha: p.probableIntroducingCommit.shortSha,
              author: p.probableIntroducingCommit.author,
              date: p.probableIntroducingCommit.date,
              message: p.probableIntroducingCommit.message,
              body: p.probableIntroducingCommit.body,
              associatedPR: p.probableIntroducingCommit.associatedPR,
            }
          : undefined,
        introductionConfidence: p.introductionConfidence,
        introductionEvidence: p.introductionEvidence,
        recentModifyingCommits: p.recentModifyingCommits.map((c) => ({
          sha: c.sha,
          shortSha: c.shortSha,
          author: c.author,
          date: c.date,
          message: c.message,
          body: c.body,
          associatedPR: c.associatedPR,
        })),
      })),
      validationSurface: {
        directTests: validationSurface.directTests,
        callerTests: validationSurface.callerTests,
        level: validationSurface.level,
        explanation: validationSurface.explanation,
      },
      impactProfile: {
        referenceFanOut: impactProfile.referenceFanOut,
        historicalChurn: impactProfile.historicalChurn,
        validationSurface: impactProfile.validationSurface,
        overallImpact: impactProfile.overallImpact,
      },
      limitations,
    };

    // Assert schema validity
    return EvidenceValidator.assertValid(graph);
  }

  /**
   * Serializes the complete EvidenceGraph to .issuepilot/evidence/<issue-number>.json
   */
  static serializeToFile(graph: EvidenceGraph, rootDir: string): string {
    const outputDir = path.join(rootDir, ".issuepilot", "evidence");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `${graph.issue.number}.json`);
    fs.writeFileSync(filePath, JSON.stringify(graph, null, 2), "utf-8");
    return normalizePath(filePath);
  }
}
