import { EvidenceGraph } from "../evidence/schema.js";
import { LLMProviderError } from "../utils/errors.js";
import { constructSynthesisPrompt, SYSTEM_INSTRUCTION } from "./prompt.js";
import { ContributorBrief, ContributorBriefSchema } from "./schema.js";

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateContributorBrief(evidence: EvidenceGraph): Promise<ContributorBrief>;
}

export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(apiKey?: string, model = "gemini-2.5-flash") {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateContributorBrief(evidence: EvidenceGraph): Promise<ContributorBrief> {
    if (!this.apiKey) {
      throw new LLMProviderError("GEMINI_API_KEY is not set.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const prompt = constructSynthesisPrompt(evidence);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(`Gemini API returned status ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new LLMProviderError("Gemini API returned empty response candidates.");
      }

      const parsed = JSON.parse(rawText);
      const validated = ContributorBriefSchema.parse({
        ...parsed,
        providerMetadata: {
          provider: "gemini",
          model: this.model,
          synthesizedAt: new Date().toISOString(),
        },
      });

      return validated;
    } catch (err: unknown) {
      if (err instanceof LLMProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new LLMProviderError(`Gemini synthesis failed: ${msg}`, err);
    }
  }
}

export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai";
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(apiKey?: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateContributorBrief(evidence: EvidenceGraph): Promise<ContributorBrief> {
    if (!this.apiKey) {
      throw new LLMProviderError("OPENAI_API_KEY is not set.");
    }

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const prompt = constructSynthesisPrompt(evidence);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(`OpenAI API returned status ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      };

      const rawText = json.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new LLMProviderError("OpenAI API returned empty response choices.");
      }

      const parsed = JSON.parse(rawText);
      const validated = ContributorBriefSchema.parse({
        ...parsed,
        providerMetadata: {
          provider: "openai",
          model: this.model,
          synthesizedAt: new Date().toISOString(),
        },
      });

      return validated;
    } catch (err: unknown) {
      if (err instanceof LLMProviderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new LLMProviderError(`OpenAI synthesis failed: ${msg}`, err);
    }
  }
}

/**
 * Resolves the appropriate LLM provider based on configuration and environment variables.
 */
export function getLLMProvider(preferredProvider?: string): LLMProvider | null {
  const envProvider = preferredProvider || process.env.LLM_PROVIDER;

  if (envProvider === "openai") {
    const openai = new OpenAILLMProvider();
    if (openai.isConfigured()) return openai;
  }

  if (envProvider === "gemini") {
    const gemini = new GeminiLLMProvider();
    if (gemini.isConfigured()) return gemini;
  }

  // Auto-detect based on available keys
  const gemini = new GeminiLLMProvider();
  if (gemini.isConfigured()) return gemini;

  const openai = new OpenAILLMProvider();
  if (openai.isConfigured()) return openai;

  return null;
}
