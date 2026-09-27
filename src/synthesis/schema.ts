import { z } from "zod";

export const ClaimWithEvidenceSchema = z.object({
  claim: z.string(),
  confidence: z.enum(["HIGH", "MEDIUM", "UNCERTAIN"]),
  evidence: z.array(z.string()),
});
export type ClaimWithEvidence = z.infer<typeof ClaimWithEvidenceSchema>;

export const ContributorBriefSchema = z.object({
  observedProblem: z.string(),
  historicalIntent: z.string(),
  implementationSurface: z.array(ClaimWithEvidenceSchema),
  existingPatterns: z.array(z.string()),
  validationStrategy: z.object({
    existingTests: z.array(z.string()),
    suggestedScenarios: z.array(z.string()),
  }),
  confidenceSections: z.object({
    highConfidence: z.array(z.string()),
    mediumConfidence: z.array(z.string()),
    uncertainOpenQuestions: z.array(z.string()),
  }),
  openQuestions: z.array(z.string()),
  limitations: z.array(z.string()),
  providerMetadata: z
    .object({
      provider: z.string(),
      model: z.string().optional(),
      synthesizedAt: z.string(),
    })
    .optional(),
});
export type ContributorBrief = z.infer<typeof ContributorBriefSchema>;
