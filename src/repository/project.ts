import fs from "node:fs";
import path from "node:path";
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget } from "ts-morph";
import { normalizePath } from "../utils/paths.js";
import { FileInventory } from "./fileDiscovery.js";

export interface ProjectInitResult {
  project: Project;
  hasTsConfig: boolean;
  tsConfigPath?: string;
  limitations: string[];
}

export class TsMorphProjectManager {
  private project: Project | null = null;
  private readonly limitations: string[] = [];

  constructor(private readonly rootDir: string) {}

  /**
   * Initializes a ts-morph Project safely. Never crashes on invalid TS syntax or compile errors.
   */
  initialize(inventory: FileInventory): ProjectInitResult {
    const tsConfigPath = path.join(this.rootDir, "tsconfig.json");
    let hasTsConfig = false;

    if (fs.existsSync(tsConfigPath)) {
      try {
        this.project = new Project({
          tsConfigFilePath: tsConfigPath,
          skipAddingFilesFromTsConfig: false,
          skipFileDependencyResolution: false,
          compilerOptions: {
            allowJs: true,
            checkJs: false,
            noEmit: true,
          },
        });
        hasTsConfig = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.limitations.push(
          `tsconfig.json detected at ${normalizePath(tsConfigPath)} failed to load cleanly: ${msg}. Fallback compiler options applied.`,
        );
        this.project = null;
      }
    }

    if (!this.project) {
      // Create fallback project with permissive settings
      this.project = new Project({
        compilerOptions: {
          target: ScriptTarget.ESNext,
          module: ModuleKind.NodeNext,
          moduleResolution: ModuleResolutionKind.NodeNext,
          allowJs: true,
          checkJs: false,
          noEmit: true,
          skipLibCheck: true,
          strict: false,
          esModuleInterop: true,
        },
      });
    }

    // Ensure all discovered files are included in the project
    const allFiles = [...inventory.sourceFiles, ...inventory.testFiles];
    for (const relPath of allFiles) {
      const fullPath = path.join(this.rootDir, relPath);
      try {
        if (!this.project.getSourceFile(fullPath)) {
          this.project.addSourceFileAtPathIfExists(fullPath);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.limitations.push(`Failed to parse file into AST [${relPath}]: ${msg}`);
      }
    }

    return {
      project: this.project,
      hasTsConfig,
      tsConfigPath: hasTsConfig ? normalizePath(tsConfigPath) : undefined,
      limitations: [...this.limitations],
    };
  }

  getProject(): Project {
    if (!this.project) {
      throw new Error("TsMorphProjectManager must be initialized before accessing project.");
    }
    return this.project;
  }

  getLimitations(): string[] {
    return [...this.limitations];
  }
}
