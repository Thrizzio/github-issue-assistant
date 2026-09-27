import { z } from "zod";

export const EvidenceConfidenceSchema = z.enum([
  "HIGH_CONFIDENCE",
  "MEDIUM_CONFIDENCE",
  "UNCERTAIN",
]);
export type EvidenceConfidence = z.infer<typeof EvidenceConfidenceSchema>;

export const EvidenceIssueCommentSchema = z.object({
  id: z.number(),
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type EvidenceIssueComment = z.infer<typeof EvidenceIssueCommentSchema>;

export const EvidenceCandidateSchema = z.object({
  name: z.string(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string(),
  source: z.enum(["title", "body", "inline_code", "stack_trace", "comment", "keyword"]),
  kindHint: z.enum(["class", "function", "file", "path", "keyword", "package"]).optional(),
});
export type EvidenceCandidate = z.infer<typeof EvidenceCandidateSchema>;

export const EvidenceIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string(),
  state: z.string(),
  author: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  labels: z.array(z.string()),
  comments: z.array(EvidenceIssueCommentSchema),
  url: z.string(),
  extractedKeywords: z.array(z.string()),
  mentionedSymbols: z.array(EvidenceCandidateSchema),
});
export type EvidenceIssue = z.infer<typeof EvidenceIssueSchema>;

export const EvidenceRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
  remote: z.string(),
  currentCommit: z.string(),
  rootDir: z.string(),
});
export type EvidenceRepository = z.infer<typeof EvidenceRepositorySchema>;

export const EvidenceReferenceTypeSchema = z.enum(["call", "import", "reference", "type_reference"]);

export const EvidenceReferenceSchema = z.object({
  sourceFile: z.string(),
  line: z.number(),
  column: z.number(),
  symbolName: z.string(),
  referenceType: EvidenceReferenceTypeSchema,
  snippet: z.string().optional(),
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const EvidenceSymbolKindSchema = z.enum([
  "class",
  "interface",
  "function",
  "method",
  "variable",
  "enum",
  "typeAlias",
]);

export const EvidenceSymbolSchema = z.object({
  name: z.string(),
  kind: EvidenceSymbolKindSchema,
  filePath: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  isExported: z.boolean(),
  containerName: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  discoveryReason: z.string(),
  referenceCount: z.number(),
  referencingFiles: z.array(z.string()),
  references: z.array(EvidenceReferenceSchema),
});
export type EvidenceSymbol = z.infer<typeof EvidenceSymbolSchema>;

export const EvidenceRelationshipTypeSchema = z.enum(["imports", "calls", "references", "tests"]);

export const EvidenceRelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: EvidenceRelationshipTypeSchema,
  context: z.string().optional(),
});
export type EvidenceRelationship = z.infer<typeof EvidenceRelationshipSchema>;

export const EvidenceCommitSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  author: z.string(),
  date: z.string(),
  message: z.string(),
  body: z.string().optional(),
  associatedPR: z
    .object({
      number: z.number(),
      title: z.string(),
      url: z.string(),
    })
    .optional(),
});
export type EvidenceCommit = z.infer<typeof EvidenceCommitSchema>;

export const EvidenceProvenanceSchema = z.object({
  symbolName: z.string(),
  filePath: z.string(),
  probableIntroducingCommit: EvidenceCommitSchema.optional(),
  introductionConfidence: z.enum(["MEDIUM_CONFIDENCE", "LOW_CONFIDENCE", "UNCERTAIN"]),
  introductionEvidence: z.string(),
  recentModifyingCommits: z.array(EvidenceCommitSchema),
});
export type EvidenceProvenance = z.infer<typeof EvidenceProvenanceSchema>;

export const EvidenceTestMatchSchema = z.object({
  testFile: z.string(),
  matchedReason: z.string(),
  associatedSymbol: z.string().optional(),
});
export type EvidenceTestMatch = z.infer<typeof EvidenceTestMatchSchema>;

export const EvidenceValidationSurfaceSchema = z.object({
  directTests: z.array(EvidenceTestMatchSchema),
  callerTests: z.array(EvidenceTestMatchSchema),
  level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  explanation: z.string(),
});
export type EvidenceValidationSurface = z.infer<typeof EvidenceValidationSurfaceSchema>;

export const EvidenceImpactSignalSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  evidence: z.string(),
});
export type EvidenceImpactSignal = z.infer<typeof EvidenceImpactSignalSchema>;

export const EvidenceImpactProfileSchema = z.object({
  referenceFanOut: EvidenceImpactSignalSchema,
  historicalChurn: EvidenceImpactSignalSchema,
  validationSurface: EvidenceImpactSignalSchema,
  overallImpact: z.object({
    level: z.enum(["LOW", "MEDIUM", "HIGH"]),
    rationale: z.string(),
  }),
});
export type EvidenceImpactProfile = z.infer<typeof EvidenceImpactProfileSchema>;

export const EvidenceGraphSchema = z.object({
  version: z.literal("1.0.0").default("1.0.0"),
  generatedAt: z.string(),
  issue: EvidenceIssueSchema,
  repository: EvidenceRepositorySchema,
  symbols: z.array(EvidenceSymbolSchema),
  relationships: z.array(EvidenceRelationshipSchema),
  provenance: z.array(EvidenceProvenanceSchema),
  validationSurface: EvidenceValidationSurfaceSchema,
  impactProfile: EvidenceImpactProfileSchema,
  limitations: z.array(z.string()),
});
export type EvidenceGraph = z.infer<typeof EvidenceGraphSchema>;
