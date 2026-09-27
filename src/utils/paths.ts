import path from "node:path";

/**
 * Normalizes a filesystem path to forward slashes for cross-platform consistency.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Converts an absolute path to a relative path against a root directory,
 * normalized with forward slashes.
 */
export function toRelativePath(rootPath: string, targetPath: string): string {
  const rel = path.relative(rootPath, targetPath);
  return normalizePath(rel);
}

/**
 * Checks if a given path is an absolute path.
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}
