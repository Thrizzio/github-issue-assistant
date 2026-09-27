import { ZodError } from "zod";
import { EvidenceGraph, EvidenceGraphSchema } from "./schema.js";

export interface ValidationResult {
  valid: boolean;
  graph?: EvidenceGraph;
  errors?: string[];
}

export class EvidenceValidator {
  /**
   * Validates an EvidenceGraph against its formal Zod schema.
   */
  static validate(data: unknown): ValidationResult {
    try {
      const graph = EvidenceGraphSchema.parse(data);
      return { valid: true, graph };
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(
          (e) => `[${e.path.join(".") || "root"}]: ${e.message}`,
        );
        return { valid: false, errors };
      }
      return { valid: false, errors: [String(err)] };
    }
  }

  /**
   * Strictly validates and throws on schema invalidity.
   */
  static assertValid(data: unknown): EvidenceGraph {
    return EvidenceGraphSchema.parse(data);
  }
}
