import { describe, expect, it } from "vitest";
import { parseGitLogOutput } from "../../src/archaeology/commits.js";

describe("parseGitLogOutput", () => {
  it("correctly parses record-separator delimited git log output", () => {
    const raw =
      "7a31c2def89a1\x007a31c2d\x00Alice Engineer\x002025-01-15T12:00:00Z\x00feat: add RequestExecutor\x00Initial implementation details\x1e" +
      "b412e8910fed2\x00b412e89\x00Bob Maintainer\x002025-02-01T15:30:00Z\x00fix: handle retry timeout\x00Additional fixes\x1e";

    const commits = parseGitLogOutput(raw);

    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      sha: "7a31c2def89a1",
      shortSha: "7a31c2d",
      author: "Alice Engineer",
      date: "2025-01-15T12:00:00Z",
      message: "feat: add RequestExecutor",
      body: "Initial implementation details",
    });

    expect(commits[1]).toEqual({
      sha: "b412e8910fed2",
      shortSha: "b412e89",
      author: "Bob Maintainer",
      date: "2025-02-01T15:30:00Z",
      message: "fix: handle retry timeout",
      body: "Additional fixes",
    });
  });

  it("handles empty or whitespace-only git output", () => {
    expect(parseGitLogOutput("")).toEqual([]);
    expect(parseGitLogOutput("   \n\t  ")).toEqual([]);
  });
});
