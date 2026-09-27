import fs from "node:fs";
import path from "node:path";
import { normalizePath, toRelativePath } from "../utils/paths.js";

export interface FileInventory {
  sourceFiles: string[]; // Relative paths, forward slash
  testFiles: string[]; // Relative paths, forward slash
  totalFileCount: number;
}

const DEFAULT_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  "vendor",
  ".cache",
  ".issuepilot",
  "out",
  ".antigravitycli",
  ".antigravity",
]);

const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function isTestFile(filePath: string): boolean {
  const norm = normalizePath(filePath).toLowerCase();
  if (norm.includes("/__tests__/") || norm.includes("/tests/") || norm.includes("/test/")) {
    return true;
  }
  return (
    norm.endsWith(".test.ts") ||
    norm.endsWith(".test.tsx") ||
    norm.endsWith(".spec.ts") ||
    norm.endsWith(".spec.tsx") ||
    norm.endsWith(".test.js") ||
    norm.endsWith(".test.jsx") ||
    norm.endsWith(".spec.js") ||
    norm.endsWith(".spec.jsx")
  );
}

/**
 * Parses simple .gitignore patterns from a repository root.
 */
function parseGitignore(rootDir: string): Set<string> {
  const gitignorePath = path.join(rootDir, ".gitignore");
  const patterns = new Set<string>();

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!")) {
          // Clean leading / or trailing /
          const cleaned = trimmed.replace(/^\//, "").replace(/\/$/, "");
          patterns.add(cleaned);
        }
      }
    } catch {
      // Ignore reading error
    }
  }

  return patterns;
}

export class FileDiscovery {
  constructor(private readonly rootDir: string) {}

  /**
   * Discovers all supported source files and test files in the repository.
   */
  discover(): FileInventory {
    const gitignorePatterns = parseGitignore(this.rootDir);
    const sourceFiles: string[] = [];
    const testFiles: string[] = [];

    const walk = (currentDir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = toRelativePath(this.rootDir, fullPath);

        if (entry.isDirectory()) {
          if (
            DEFAULT_EXCLUDED_DIRS.has(entry.name) ||
            gitignorePatterns.has(entry.name) ||
            gitignorePatterns.has(relPath)
          ) {
            continue;
          }
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            if (isTestFile(relPath)) {
              testFiles.push(relPath);
            } else {
              sourceFiles.push(relPath);
            }
          }
        }
      }
    };

    walk(this.rootDir);

    return {
      sourceFiles: sourceFiles.sort(),
      testFiles: testFiles.sort(),
      totalFileCount: sourceFiles.length + testFiles.length,
    };
  }
}
