import { EvidenceGraph } from "../evidence/schema.js";

export const SYSTEM_INSTRUCTION = `You are an evidence synthesis engine.
You may only make factual claims supported by the supplied EvidenceGraph.
If evidence is insufficient, classify the statement as uncertain.
Never invent files, symbols, commits, PRs, tests, architecture, or requirements.
Do not hallucinate facts. Everything you state must be traceable to the EvidenceGraph provided.`;

export function constructSynthesisPrompt(graph: EvidenceGraph): string {
  return `You are generating a structured ContributorBrief for an issue investigation.

STRICT RULES:
1. Every claim in implementationSurface must include traceable evidence strings referencing symbols, files, line numbers, or commit SHAs from the EvidenceGraph.
2. Group conclusions into High Confidence, Medium Confidence, and Uncertain / Open Questions.
3. If an aspect is not explicitly in the issue or repository evidence, list it under openQuestions or uncertainOpenQuestions.
4. Output must strictly conform to the required JSON schema.

EVIDENCE GRAPH:
${JSON.stringify(graph, null, 2)}

Respond with a JSON object adhering to this schema:
{
  "observedProblem": "Clear summary of what the issue explicitly describes vs what is observed.",
  "historicalIntent": "Explanation of historical commits, origins, and modifications discovered.",
  "implementationSurface": [
    {
      "claim": "Specific statement about where code changes likely belong",
      "confidence": "HIGH" | "MEDIUM" | "UNCERTAIN",
      "evidence": ["Symbol: X at path Y:line Z", "Commit SHA: ..."]
    }
  ],
  "existingPatterns": ["Relevant patterns discovered in existing codebase"],
  "validationStrategy": {
    "existingTests": ["Existing test paths identified in evidence"],
    "suggestedScenarios": ["Test cases needed to validate the fix"]
  },
  "confidenceSections": {
    "highConfidence": ["Facts firmly established by AST and Git evidence"],
    "mediumConfidence": ["Reasonable inferences from call sites and commit history"],
    "uncertainOpenQuestions": ["Items not proven or requiring maintainer clarification"]
  },
  "openQuestions": ["Questions for maintainers or areas needing clarification"],
  "limitations": ["Any limitations recorded during deterministic analysis"]
}`;
}
