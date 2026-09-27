import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface FixtureRepo {
  rootDir: string;
  cleanup: () => void;
}

export function createFixtureRepository(): FixtureRepo {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "issuepilot-fixture-"));

  const runGit = (args: string[]) => {
    execFileSync("git", args, {
      cwd: rootDir,
      stdio: "pipe",
      windowsHide: true,
    });
  };

  // 1. Initialize git
  runGit(["init", "-b", "main"]);
  runGit(["config", "user.name", "Test Committer"]);
  runGit(["config", "user.email", "test@example.com"]);
  runGit(["remote", "add", "origin", "https://github.com/trpc/trpc.git"]);

  // 2. Add tsconfig.json
  const tsconfigContent = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
      },
      include: ["src/**/*", "tests/**/*"],
    },
    null,
    2,
  );
  fs.writeFileSync(path.join(rootDir, "tsconfig.json"), tsconfigContent, "utf-8");

  // Create dirs
  fs.mkdirSync(path.join(rootDir, "src", "api"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "src", "auth"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "src", "utils"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "tests", "api"), { recursive: true });

  // Commit 1: Initial implementation
  fs.writeFileSync(
    path.join(rootDir, "src", "utils", "retry.ts"),
    `export function doRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  return fn();
}
`,
    "utf-8",
  );

  fs.writeFileSync(
    path.join(rootDir, "src", "api", "request.ts"),
    `import { doRetry } from "../utils/retry.js";

export interface RequestConfig {
  timeoutMs: number;
}

export class RequestExecutor {
  constructor(private readonly config: RequestConfig) {}

  async execute(url: string): Promise<string> {
    return doRetry(() => Promise.resolve(\`Response from \${url}\`), 3);
  }
}
`,
    "utf-8",
  );

  runGit(["add", "."]);
  runGit(["commit", "-m", "feat: initial implementation of RequestExecutor"]);

  // Commit 2: Add auth caller
  fs.writeFileSync(
    path.join(rootDir, "src", "auth", "auth.ts"),
    `import { RequestExecutor } from "../api/request.js";

export class AuthHandler {
  constructor(private readonly executor: RequestExecutor) {}

  async authenticate(): Promise<string> {
    return this.executor.execute("https://auth.example.com");
  }
}
`,
    "utf-8",
  );
  runGit(["add", "."]);
  runGit(["commit", "-m", "feat: add AuthHandler calling RequestExecutor"]);

  // Commit 3: Add client caller
  fs.writeFileSync(
    path.join(rootDir, "src", "api", "client.ts"),
    `import { RequestExecutor } from "./request.js";

export class ApiClient {
  private executor = new RequestExecutor({ timeoutMs: 5000 });

  async get(endpoint: string): Promise<string> {
    return this.executor.execute(endpoint);
  }
}
`,
    "utf-8",
  );
  runGit(["add", "."]);
  runGit(["commit", "-m", "feat: add ApiClient caller for RequestExecutor.execute"]);

  // Commit 4: Add tests
  fs.writeFileSync(
    path.join(rootDir, "tests", "api", "request.test.ts"),
    `import { RequestExecutor } from "../../src/api/request.js";

export function testRequestExecutor() {
  const executor = new RequestExecutor({ timeoutMs: 1000 });
  return executor.execute("https://test.example.com");
}
`,
    "utf-8",
  );
  runGit(["add", "."]);
  runGit(["commit", "-m", "test: add direct unit tests for RequestExecutor"]);

  // Commit 5: Refactor / rename helper method
  fs.writeFileSync(
    path.join(rootDir, "src", "api", "request.ts"),
    `import { doRetry } from "../utils/retry.js";

export interface RequestConfig {
  timeoutMs: number;
}

export class RequestExecutor {
  constructor(private readonly config: RequestConfig) {}

  async execute(url: string): Promise<string> {
    return this.executeWithRetry(url, 3);
  }

  async executeWithRetry(url: string, attempts: number): Promise<string> {
    return doRetry(() => Promise.resolve(\`Response from \${url}\`), attempts);
  }
}
`,
    "utf-8",
  );
  runGit(["add", "."]);
  runGit(["commit", "-m", "refactor: extract executeWithRetry in RequestExecutor"]);

  return {
    rootDir,
    cleanup: () => {
      try {
        fs.rmSync(rootDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failure on Windows temp files if locked
      }
    },
  };
}
