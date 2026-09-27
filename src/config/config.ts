import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const IssuePilotConfigSchema = z.object({
  llm: z
    .object({
      provider: z.enum(["gemini", "openai", "none"]).default("gemini"),
      model: z.string().optional(),
    })
    .default({ provider: "gemini" }),
  analysis: z
    .object({
      churnMonths: z.number().int().positive().default(6),
      maxRelevantSymbols: z.number().int().positive().default(20),
    })
    .default({ churnMonths: 6, maxRelevantSymbols: 20 }),
  output: z
    .object({
      path: z.string().default(".github/CONTRIBUTOR_CONTEXT.md"),
    })
    .default({ path: ".github/CONTRIBUTOR_CONTEXT.md" }),
});

export type IssuePilotConfig = z.infer<typeof IssuePilotConfigSchema>;

export const DEFAULT_CONFIG: IssuePilotConfig = IssuePilotConfigSchema.parse({});

/**
 * Loads configuration from .issuepilotrc.json if present in the given root dir,
 * merging with defaults.
 */
export function loadConfig(rootDir: string = process.cwd()): IssuePilotConfig {
  const configPath = path.join(rootDir, ".issuepilotrc.json");
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const rawContent = fs.readFileSync(configPath, "utf-8");
    const json = JSON.parse(rawContent);
    return IssuePilotConfigSchema.parse(json);
  } catch {
    // If parsing fails, fall back to default with a warning
    return DEFAULT_CONFIG;
  }
}
