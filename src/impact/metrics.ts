export type CategoricalLevel = "LOW" | "MEDIUM" | "HIGH";

export const IMPACT_THRESHOLDS = {
  referenceFanOut: {
    lowMax: 4,      // < 5 is LOW
    mediumMax: 20,  // 5 - 20 is MEDIUM, > 20 is HIGH
  },
  historicalChurn: {
    lowMax: 2,      // < 3 commits is LOW
    mediumMax: 10,  // 3 - 10 commits is MEDIUM, > 10 is HIGH
  },
} as const;

export function classifyFanOut(totalReferences: number): {
  level: CategoricalLevel;
  evidence: string;
} {
  if (totalReferences <= IMPACT_THRESHOLDS.referenceFanOut.lowMax) {
    return {
      level: "LOW",
      evidence: `${totalReferences} reference(s) (threshold: < 5)`,
    };
  }
  if (totalReferences <= IMPACT_THRESHOLDS.referenceFanOut.mediumMax) {
    return {
      level: "MEDIUM",
      evidence: `${totalReferences} reference(s) (threshold: 5–20)`,
    };
  }
  return {
    level: "HIGH",
    evidence: `${totalReferences} reference(s) (threshold: > 20)`,
  };
}

export function classifyChurn(commitCount: number, months: number): {
  level: CategoricalLevel;
  evidence: string;
} {
  if (commitCount <= IMPACT_THRESHOLDS.historicalChurn.lowMax) {
    return {
      level: "LOW",
      evidence: `${commitCount} commit(s) in last ${months} months (threshold: < 3)`,
    };
  }
  if (commitCount <= IMPACT_THRESHOLDS.historicalChurn.mediumMax) {
    return {
      level: "MEDIUM",
      evidence: `${commitCount} commit(s) in last ${months} months (threshold: 3–10)`,
    };
  }
  return {
    level: "HIGH",
    evidence: `${commitCount} commit(s) in last ${months} months (threshold: > 10)`,
  };
}
