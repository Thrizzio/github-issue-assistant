import { describe, expect, it } from "vitest";
import {
  classifyChurn,
  classifyFanOut,
  IMPACT_THRESHOLDS,
} from "../../src/impact/metrics.js";
import { ImpactProfiler } from "../../src/impact/profile.js";

describe("Impact Metrics & Classification", () => {
  it("classifies reference fan-out according to threshold boundaries", () => {
    // LOW: < 5 references
    expect(classifyFanOut(0).level).toBe("LOW");
    expect(classifyFanOut(4).level).toBe("LOW");

    // MEDIUM: 5–20 references
    expect(classifyFanOut(5).level).toBe("MEDIUM");
    expect(classifyFanOut(20).level).toBe("MEDIUM");

    // HIGH: > 20 references
    expect(classifyFanOut(21).level).toBe("HIGH");
    expect(classifyFanOut(100).level).toBe("HIGH");
  });

  it("classifies churn based on 6-month commit count thresholds", () => {
    // LOW: < 3 commits
    expect(classifyChurn(0, 6).level).toBe("LOW");
    expect(classifyChurn(2, 6).level).toBe("LOW");

    // MEDIUM: 3–10 commits
    expect(classifyChurn(3, 6).level).toBe("MEDIUM");
    expect(classifyChurn(10, 6).level).toBe("MEDIUM");

    // HIGH: > 10 commits
    expect(classifyChurn(11, 6).level).toBe("HIGH");
    expect(classifyChurn(50, 6).level).toBe("HIGH");
  });

  it("derives overall impact properly from individual signals", () => {
    const profiler = new ImpactProfiler();

    // High fanout should result in overall HIGH
    const highProfile = profiler.calculateProfile(
      new Map([
        [
          "file.ts:Sym",
          {
            symbolName: "Sym",
            symbolFile: "file.ts",
            references: Array(25).fill({
              sourceFile: "a.ts",
              line: 1,
              column: 1,
              symbolName: "Sym",
              referenceType: "call",
            }),
            fanOutCount: 25,
            referencingFiles: ["a.ts"],
          },
        ],
      ]),
      {
        timeWindowMonths: 6,
        sinceDate: "2025-01-01",
        totalCommits: 1,
        commitsByFile: {},
        recentCommits: [],
        filteredFormattingCommits: 0,
      },
      {
        directTests: [],
        callerTests: [],
        level: "LOW",
        explanation: "No tests found",
      },
    );

    expect(highProfile.referenceFanOut.level).toBe("HIGH");
    expect(highProfile.overallImpact.level).toBe("HIGH");
  });
});
