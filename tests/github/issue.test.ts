import { describe, expect, it } from "vitest";
import { extractIssueCandidates } from "../../src/github/issue.js";

describe("extractIssueCandidates", () => {
  it("extracts backtick symbols with HIGH confidence", () => {
    const title = "Crash in RequestExecutor";
    const body =
      "When invoking `RequestExecutor.execute()`, an exception is thrown in `src/api/request.ts`.";

    const candidates = extractIssueCandidates(title, body);

    const reqExec = candidates.find((c) => c.name === "RequestExecutor");
    expect(reqExec).toBeDefined();
    expect(reqExec?.confidence).toBe("HIGH");

    const execCall = candidates.find((c) => c.name === "RequestExecutor.execute");
    expect(execCall).toBeDefined();
    expect(execCall?.confidence).toBe("HIGH");

    const filePath = candidates.find((c) => c.name === "src/api/request.ts");
    expect(filePath).toBeDefined();
    expect(filePath?.confidence).toBe("HIGH");
    expect(filePath?.kindHint).toBe("path");
  });

  it("extracts stack traces with class and method frames", () => {
    const title = "Unhandled rejection";
    const body = `
Error: Request timed out
    at RequestExecutor.execute (src/api/request.ts:42:15)
    at ApiClient.fetch (src/api/client.ts:18:9)
    `;

    const candidates = extractIssueCandidates(title, body);

    const reqExec = candidates.find((c) => c.name === "RequestExecutor");
    expect(reqExec).toBeDefined();
    expect(reqExec?.source).toBe("stack_trace");
    expect(reqExec?.confidence).toBe("HIGH");

    const executeMethod = candidates.find((c) => c.name === "execute");
    expect(executeMethod).toBeDefined();
    expect(executeMethod?.source).toBe("stack_trace");

    const apiClient = candidates.find((c) => c.name === "ApiClient");
    expect(apiClient).toBeDefined();
  });

  it("extracts PascalCase symbols from title as HIGH and body as MEDIUM", () => {
    const title = "Fix MemoryLeak in SessionStore";
    const body = "The ConnectionPool is leaking sockets upon reconnect.";

    const candidates = extractIssueCandidates(title, body);

    const sessionStore = candidates.find((c) => c.name === "SessionStore");
    expect(sessionStore).toBeDefined();
    expect(sessionStore?.confidence).toBe("HIGH");

    const connPool = candidates.find((c) => c.name === "ConnectionPool");
    expect(connPool).toBeDefined();
    expect(connPool?.confidence).toBe("MEDIUM");
  });

  it("extracts natural-language keywords as LOW confidence and filters stop words", () => {
    const title = "Add retry mechanism for network timeouts";
    const body = "Please fix this bug when connection fails.";

    const candidates = extractIssueCandidates(title, body);

    // Stop words like "this", "bug", "please" must be excluded
    expect(candidates.find((c) => c.name.toLowerCase() === "this")).toBeUndefined();
    expect(candidates.find((c) => c.name.toLowerCase() === "bug")).toBeUndefined();
    expect(candidates.find((c) => c.name.toLowerCase() === "please")).toBeUndefined();

    // Meaningful keyword like "retry" or "timeouts" should be present as LOW confidence
    const retry = candidates.find((c) => c.name.toLowerCase() === "retry");
    expect(retry).toBeDefined();
    expect(retry?.confidence).toBe("LOW");
  });
});
