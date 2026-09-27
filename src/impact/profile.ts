import { ChurnReport } from "../archaeology/churn.js";
import { SymbolReferenceSummary } from "../repository/references.js";
import { ValidationSurface } from "../repository/tests.js";
import { CategoricalLevel, classifyChurn, classifyFanOut } from "./metrics.js";

export interface ImpactSignal {
  level: CategoricalLevel;
  evidence: string;
}

export interface ImpactProfile {
  referenceFanOut: ImpactSignal;
  historicalChurn: ImpactSignal;
  validationSurface: ImpactSignal;
  overallImpact: {
    level: CategoricalLevel;
    rationale: string;
  };
}

export class ImpactProfiler {
  /**
   * Calculates categorical impact profile based on fan-out, churn, and validation surface evidence.
   */
  calculateProfile(
    referenceSummaries: Map<string, SymbolReferenceSummary>,
    churnReport: ChurnReport,
    validationSurface: ValidationSurface,
  ): ImpactProfile {
    // 1. Calculate total semantic references across all symbols
    let totalRefs = 0;
    for (const summary of referenceSummaries.values()) {
      totalRefs += summary.fanOutCount;
    }
    const fanOut = classifyFanOut(totalRefs);

    // 2. Churn signal
    const churn = classifyChurn(churnReport.totalCommits, churnReport.timeWindowMonths);

    // 3. Validation surface signal (distinction: test presence, not line coverage)
    const valSurface: ImpactSignal = {
      level: validationSurface.level,
      evidence: validationSurface.explanation,
    };

    // 4. Derive overall impact
    // If high fan-out, blast radius is wide -> HIGH.
    // If low validation surface and (medium/high fanout or high churn) -> HIGH.
    // If medium fan-out or high churn with tests -> MEDIUM.
    // Otherwise LOW.
    let overallLevel: CategoricalLevel = "LOW";
    let rationale = "";

    if (fanOut.level === "HIGH") {
      overallLevel = "HIGH";
      rationale = `Overall HIGH impact driven by wide reference fan-out (${fanOut.evidence}), requiring careful regression testing across multiple callers.`;
    } else if (valSurface.level === "LOW" && (fanOut.level === "MEDIUM" || churn.level === "HIGH")) {
      overallLevel = "HIGH";
      rationale = `Overall HIGH impact: modifications touch active or referenced components without direct test coverage to verify behavior.`;
    } else if (fanOut.level === "MEDIUM" || churn.level === "HIGH") {
      overallLevel = "MEDIUM";
      rationale = `Overall MEDIUM impact: moderate fan-out or active recent churn, supported by ${valSurface.level.toLowerCase()} validation surface.`;
    } else {
      overallLevel = "LOW";
      rationale = `Overall LOW impact: isolated symbol surface (< 5 references) with minimal recent churn.`;
    }

    return {
      referenceFanOut: fanOut,
      historicalChurn: churn,
      validationSurface: valSurface,
      overallImpact: {
        level: overallLevel,
        rationale,
      },
    };
  }
}
