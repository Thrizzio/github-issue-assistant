import {
  ClassDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  InterfaceDeclaration,
  Node,
  Project,
  SourceFile,
  TypeAliasDeclaration,
  VariableDeclaration,
} from "ts-morph";
import { CandidateIdentifier } from "../github/issue.js";
import { normalizePath, toRelativePath } from "../utils/paths.js";

export type SymbolKind =
  | "class"
  | "interface"
  | "function"
  | "method"
  | "variable"
  | "enum"
  | "typeAlias";

export type SymbolConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface DiscoveredSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string; // Relative path, normalized
  startLine: number;
  endLine: number;
  isExported: boolean;
  containerName?: string; // e.g. class name if it is a method
  confidence: SymbolConfidence;
  discoveryReason: string;
  matchScore: number;
  astNode?: Node;
}

export class SymbolDiscovery {
  constructor(
    private readonly project: Project,
    private readonly rootDir: string,
  ) {}

  /**
   * Searches the project AST for symbols relevant to the extracted candidate identifiers and keywords.
   */
  findCandidateSymbols(
    candidates: CandidateIdentifier[],
    maxSymbols = 25,
  ): DiscoveredSymbol[] {
    const symbols: DiscoveredSymbol[] = [];
    const sourceFiles = this.project.getSourceFiles();

    // Map candidates for quick matching
    const exactMap = new Map<string, CandidateIdentifier>();
    const lowerMap = new Map<string, CandidateIdentifier>();
    const pathCandidates: CandidateIdentifier[] = [];

    for (const c of candidates) {
      exactMap.set(c.name, c);
      lowerMap.set(c.name.toLowerCase(), c);
      if (c.kindHint === "path" || c.kindHint === "file" || c.name.includes("/")) {
        pathCandidates.push(c);
      }
    }

    for (const sf of sourceFiles) {
      const fullPath = sf.getFilePath();
      const relPath = toRelativePath(this.rootDir, fullPath);

      // Do not index test files as candidate production symbols
      const normRel = normalizePath(relPath).toLowerCase();
      if (
        normRel.includes(".test.") ||
        normRel.includes(".spec.") ||
        normRel.includes("/__tests__/")
      ) {
        continue;
      }

      const fileMatchesPathHint = pathCandidates.some((pc) => {
        const hint = pc.name.replace(/\\/g, "/").toLowerCase();
        return normRel.endsWith(hint) || normRel.includes(hint);
      });

      // 1. Classes and Methods
      for (const cls of sf.getClasses()) {
        const clsName = cls.getName();
        if (clsName) {
          this.evaluateAndCollect(
            cls,
            clsName,
            "class",
            relPath,
            cls.isExported(),
            undefined,
            exactMap,
            lowerMap,
            fileMatchesPathHint,
            symbols,
          );

          for (const method of cls.getMethods()) {
            const methodName = method.getName();
            this.evaluateAndCollect(
              method,
              methodName,
              "method",
              relPath,
              cls.isExported(),
              clsName,
              exactMap,
              lowerMap,
              fileMatchesPathHint,
              symbols,
            );
          }
        }
      }

      // 2. Functions
      for (const fn of sf.getFunctions()) {
        const fnName = fn.getName();
        if (fnName) {
          this.evaluateAndCollect(
            fn,
            fnName,
            "function",
            relPath,
            fn.isExported(),
            undefined,
            exactMap,
            lowerMap,
            fileMatchesPathHint,
            symbols,
          );
        }
      }

      // 3. Interfaces
      for (const iface of sf.getInterfaces()) {
        const ifaceName = iface.getName();
        this.evaluateAndCollect(
          iface,
          ifaceName,
          "interface",
          relPath,
          iface.isExported(),
          undefined,
          exactMap,
          lowerMap,
          fileMatchesPathHint,
          symbols,
        );
      }

      // 4. Type Aliases
      for (const ta of sf.getTypeAliases()) {
        const taName = ta.getName();
        this.evaluateAndCollect(
          ta,
          taName,
          "typeAlias",
          relPath,
          ta.isExported(),
          undefined,
          exactMap,
          lowerMap,
          fileMatchesPathHint,
          symbols,
        );
      }

      // 5. Enums
      for (const en of sf.getEnums()) {
        const enName = en.getName();
        this.evaluateAndCollect(
          en,
          enName,
          "enum",
          relPath,
          en.isExported(),
          undefined,
          exactMap,
          lowerMap,
          fileMatchesPathHint,
          symbols,
        );
      }

      // 6. Exported Variables / Arrow Functions
      for (const stmt of sf.getVariableStatements()) {
        if (stmt.isExported()) {
          for (const decl of stmt.getDeclarations()) {
            const varName = decl.getName();
            this.evaluateAndCollect(
              decl,
              varName,
              "variable",
              relPath,
              true,
              undefined,
              exactMap,
              lowerMap,
              fileMatchesPathHint,
              symbols,
            );
          }
        }
      }
    }

    // Sort by matchScore descending, then by line count, and deduplicate
    const seen = new Set<string>();
    const deduplicated: DiscoveredSymbol[] = [];

    symbols.sort((a, b) => b.matchScore - a.matchScore);

    for (const s of symbols) {
      const key = `${s.filePath}:${s.name}:${s.kind}:${s.containerName ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(s);
        if (deduplicated.length >= maxSymbols) break;
      }
    }

    return deduplicated;
  }

  private evaluateAndCollect(
    node: Node,
    name: string,
    kind: SymbolKind,
    relPath: string,
    isExported: boolean,
    containerName: string | undefined,
    exactMap: Map<string, CandidateIdentifier>,
    lowerMap: Map<string, CandidateIdentifier>,
    fileMatchesPathHint: boolean,
    outSymbols: DiscoveredSymbol[],
  ): void {
    const fullName = containerName ? `${containerName}.${name}` : name;
    let confidence: SymbolConfidence | null = null;
    let reason = "";
    let score = 0;

    // Check exact match (standalone name or fullName)
    const exactMatch = exactMap.get(name) || exactMap.get(fullName);
    if (exactMatch) {
      confidence = exactMatch.confidence;
      score += exactMatch.confidence === "HIGH" ? 100 : 70;
      reason = `Exact identifier match with issue ${exactMatch.source} candidate [${exactMatch.name}]: ${exactMatch.reason}`;
    } else {
      // Check case-insensitive match
      const lowerMatch = lowerMap.get(name.toLowerCase()) || lowerMap.get(fullName.toLowerCase());
      if (lowerMatch) {
        confidence = lowerMatch.confidence === "HIGH" ? "MEDIUM" : "LOW";
        score += 50;
        reason = `Case-insensitive match with issue candidate [${lowerMatch.name}]`;
      }
    }

    // If file matches a path hint mentioned in the issue, boost confidence
    if (fileMatchesPathHint) {
      score += 30;
      if (!confidence) {
        confidence = "MEDIUM";
        reason = `Symbol located inside file matching issue path hint: ${relPath}`;
      } else {
        reason += ` (located in file matching issue path hint: ${relPath})`;
      }
    }

    if (confidence) {
      const startLine = node.getStartLineNumber();
      const endLine = node.getEndLineNumber();

      outSymbols.push({
        name,
        kind,
        filePath: relPath,
        startLine,
        endLine,
        isExported,
        containerName,
        confidence,
        discoveryReason: reason,
        matchScore: score,
        astNode: node,
      });
    }
  }
}
