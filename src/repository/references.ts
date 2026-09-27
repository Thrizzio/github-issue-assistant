import { Node, ReferencedSymbol } from "ts-morph";
import { toRelativePath } from "../utils/paths.js";
import { DiscoveredSymbol } from "./symbols.js";

export type ReferenceType = "call" | "import" | "reference" | "type_reference";

export interface SymbolReference {
  sourceFile: string; // Relative path, normalized
  line: number;
  column: number;
  symbolName: string;
  referenceType: ReferenceType;
  snippet?: string;
}

export interface SymbolReferenceSummary {
  symbolName: string;
  symbolFile: string;
  references: SymbolReference[];
  fanOutCount: number;
  referencingFiles: string[];
}

export interface CodeRelationship {
  from: string;
  to: string;
  type: "imports" | "calls" | "references" | "tests";
  context?: string;
}

export class ReferenceAnalyzer {
  constructor(private readonly rootDir: string) {}

  /**
   * Analyzes semantic references and call sites for discovered symbols.
   */
  findReferences(
    symbols: DiscoveredSymbol[],
    onWarning?: (msg: string) => void,
  ): {
    summaries: Map<string, SymbolReferenceSummary>;
    relationships: CodeRelationship[];
  } {
    const summaries = new Map<string, SymbolReferenceSummary>();
    const relationships: CodeRelationship[] = [];

    for (const sym of symbols) {
      const symKey = `${sym.filePath}:${sym.containerName ? `${sym.containerName}.` : ""}${sym.name}`;
      const refs: SymbolReference[] = [];
      const refFiles = new Set<string>();

      if (!sym.astNode) {
        summaries.set(symKey, {
          symbolName: sym.name,
          symbolFile: sym.filePath,
          references: [],
          fanOutCount: 0,
          referencingFiles: [],
        });
        continue;
      }

      try {
        let referencedSymbols: ReferencedSymbol[] = [];

        // For classes, functions, interfaces, methods, or variable declarations
        if (Node.isReferenceFindable(sym.astNode)) {
          referencedSymbols = sym.astNode.findReferences();
        } else {
          // If node isn't directly reference findable, try its name node
          const nameNode = (sym.astNode as unknown as { getNameNode?: () => Node }).getNameNode?.();
          if (nameNode && Node.isReferenceFindable(nameNode)) {
            referencedSymbols = nameNode.findReferences();
          }
        }

        const seenPositions = new Set<string>();

        for (const refSymbol of referencedSymbols) {
          for (const refEntry of refSymbol.getReferences()) {
            // "Do not count the symbol declaration as a reference"
            if (refEntry.isDefinition()) {
              continue;
            }

            const refSourceFile = refEntry.getSourceFile();
            const refRelPath = toRelativePath(this.rootDir, refSourceFile.getFilePath());
            const pos = refEntry.getNode().getStart();
            const lineCol = refSourceFile.getLineAndColumnAtPos(pos);
            const line = lineCol.line;
            const column = lineCol.column;

            const dedupeKey = `${refRelPath}:${line}:${column}`;
            if (seenPositions.has(dedupeKey)) {
              continue;
            }
            seenPositions.add(dedupeKey);

            // Determine reference type (call vs import vs reference)
            const parent = refEntry.getNode().getParent();
            let refType: ReferenceType = "reference";
            if (parent && Node.isCallExpression(parent)) {
              refType = "call";
            } else if (
              parent &&
              (Node.isImportSpecifier(parent) ||
                Node.isImportClause(parent) ||
                Node.isNamespaceImport(parent))
            ) {
              refType = "import";
            } else if (
              parent &&
              (Node.isTypeReference(parent) || Node.isTypeAliasDeclaration(parent))
            ) {
              refType = "type_reference";
            }

            // Extract small code line snippet
            let snippet = "";
            try {
              const fullText = refSourceFile.getFullText();
              const lines = fullText.split(/\r?\n/);
              if (line >= 1 && line <= lines.length) {
                snippet = lines[line - 1].trim();
              }
            } catch {
              // Ignore snippet extraction error
            }

            refs.push({
              sourceFile: refRelPath,
              line,
              column,
              symbolName: sym.name,
              referenceType: refType,
              snippet: snippet ? snippet.slice(0, 120) : undefined,
            });

            refFiles.add(refRelPath);

            // Record relationship
            relationships.push({
              from: refRelPath,
              to: `${sym.filePath}:${sym.name}`,
              type: refType === "call" ? "calls" : refType === "import" ? "imports" : "references",
              context: `line ${line}`,
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onWarning?.(
          `Failed to resolve references for symbol ${sym.name} in ${sym.filePath}: ${msg}`,
        );
      }

      summaries.set(symKey, {
        symbolName: sym.name,
        symbolFile: sym.filePath,
        references: refs,
        fanOutCount: refs.length,
        referencingFiles: Array.from(refFiles),
      });
    }

    return {
      summaries,
      relationships: deduplicateRelationships(relationships),
    };
  }
}

function deduplicateRelationships(relationships: CodeRelationship[]): CodeRelationship[] {
  const seen = new Set<string>();
  const res: CodeRelationship[] = [];
  for (const r of relationships) {
    const key = `${r.from}->${r.to}:${r.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      res.push(r);
    }
  }
  return res;
}
