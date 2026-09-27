import { normalizePath } from "../utils/paths.js";
import { isTestFile } from "./fileDiscovery.js";
import { SymbolReferenceSummary } from "./references.js";
import { DiscoveredSymbol } from "./symbols.js";

export type ValidationSurfaceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TestMatch {
  testFile: string;
  matchedReason: string;
  associatedSymbol?: string;
}

export interface ValidationSurface {
  directTests: TestMatch[];
  callerTests: TestMatch[];
  level: ValidationSurfaceLevel;
  explanation: string;
}

export class TestDiscovery {
  /**
   * Identifies direct tests and caller tests for the investigated symbols.
   */
  discoverTests(
    allTestFiles: string[],
    symbols: DiscoveredSymbol[],
    referenceSummaries: Map<string, SymbolReferenceSummary>,
  ): ValidationSurface {
    const directTestsMap = new Map<string, TestMatch>();
    const callerTestsMap = new Map<string, TestMatch>();

    // Collect all symbol files and their caller files
    const symbolFiles = new Set(symbols.map((s) => s.filePath));
    const callerFiles = new Set<string>();

    for (const summary of referenceSummaries.values()) {
      for (const f of summary.referencingFiles) {
        if (!isTestFile(f)) {
          callerFiles.add(f);
        }
      }
    }

    // 1. Check references in referenceSummaries:
    for (const summary of referenceSummaries.values()) {
      for (const ref of summary.references) {
        if (isTestFile(ref.sourceFile)) {
          if (!directTestsMap.has(ref.sourceFile)) {
            directTestsMap.set(ref.sourceFile, {
              testFile: ref.sourceFile,
              matchedReason: `Directly references symbol ${summary.symbolName} at line ${ref.line}`,
              associatedSymbol: summary.symbolName,
            });
          }
        }
      }
    }

    // 2. Check naming heuristics across allTestFiles:
    // e.g. if symbol is in `src/api/request.ts`, matching `tests/api/request.test.ts` or `src/api/request.test.ts`
    for (const testFile of allTestFiles) {
      if (directTestsMap.has(testFile)) continue;

      const normTest = normalizePath(testFile).toLowerCase();
      for (const sFile of symbolFiles) {
        const baseName =
          sFile
            .split("/")
            .pop()
            ?.replace(/\.(ts|tsx|js|jsx)$/, "") ?? "";
        if (baseName.length > 2) {
          const testBase = normTest.split("/").pop() ?? "";
          if (
            testBase.startsWith(`${baseName.toLowerCase()}.test.`) ||
            testBase.startsWith(`${baseName.toLowerCase()}.spec.`)
          ) {
            directTestsMap.set(testFile, {
              testFile,
              matchedReason: `Direct filename convention match for ${sFile}`,
            });
            break;
          }
        }
      }

      // Check caller tests via naming
      if (!directTestsMap.has(testFile) && !callerTestsMap.has(testFile)) {
        for (const cFile of callerFiles) {
          const baseName =
            cFile
              .split("/")
              .pop()
              ?.replace(/\.(ts|tsx|js|jsx)$/, "") ?? "";
          if (baseName.length > 2) {
            const testBase = normTest.split("/").pop() ?? "";
            if (
              testBase.startsWith(`${baseName.toLowerCase()}.test.`) ||
              testBase.startsWith(`${baseName.toLowerCase()}.spec.`)
            ) {
              callerTestsMap.set(testFile, {
                testFile,
                matchedReason: `Exercises caller file ${cFile}`,
              });
              break;
            }
          }
        }
      }
    }

    const directTests = Array.from(directTestsMap.values());
    const callerTests = Array.from(callerTestsMap.values());

    // Calculate validation surface level
    // Distinction: This represents validation-surface evidence (existence of direct/caller tests), NOT code line coverage.
    let level: ValidationSurfaceLevel = "LOW";
    let explanation = "";

    if (directTests.length >= 2 || (directTests.length >= 1 && callerTests.length >= 2)) {
      level = "HIGH";
      explanation = `High validation surface: ${directTests.length} direct test(s) and ${callerTests.length} caller test(s) identified.`;
    } else if (directTests.length === 1 || callerTests.length >= 1) {
      level = "MEDIUM";
      explanation = `Medium validation surface: ${directTests.length} direct test(s) and ${callerTests.length} caller test(s) identified.`;
    } else {
      level = "LOW";
      explanation = `Low validation surface: No direct or caller tests identified for relevant symbols.`;
    }

    return {
      directTests,
      callerTests,
      level,
      explanation,
    };
  }
}
