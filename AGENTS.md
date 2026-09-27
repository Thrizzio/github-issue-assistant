# IssuePilot — Codebase Archaeology & Contributor Reconnaissance CLI

## What this is
A production-quality CLI tool that investigates a GitHub issue inside a locally cloned TypeScript/JavaScript codebase and produces an evidence-backed reconnaissance brief (`CONTRIBUTOR_CONTEXT.md`).
Operates on the strict principle: `DETERMINISTIC ANALYSIS → EVIDENCE GRAPH → LLM SYNTHESIS`.

## Stack
- Language: TypeScript 5 (strict mode, native ESM)
- Runtime: Node.js (>=18)
- AST Engine: ts-morph (TypeScript Compiler API)
- GitHub API: @octokit/rest
- Validation: Zod
- CLI UI: Commander.js, Chalk, Ora
- Testing: Vitest
- Linting & Formatting: ESLint, Prettier

## Commands
- Build: `npm run build`
- Test: `npm test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format: `npm run format:check`
- Run locally: `node dist/cli/index.js investigate <issue-number>`

## Conventions
- Always use `child_process.execFile` with argument arrays for Git operations — never shell string interpolation.
- The LLM receives ONLY the verified `EvidenceGraph`, never arbitrary repo code or instructions to guess.
- Fall back gracefully to deterministic analysis if the LLM provider is unavailable or `--no-llm` is used.
- All domain models must have runtime Zod schemas.
- High, Medium, and Uncertain confidence levels must be explicitly tagged for every claim.

## Treat as high-stakes (explain before implementing)
- GitHub authentication and API token handling: Never print or log tokens, passwords, or Authorization headers.
- Git execution: Target repositories are untrusted input; never execute arbitrary code, npm scripts, or repo build scripts.
- Evidence accuracy: Never fabricate AST symbols, call graphs, or Git history. If evidence is absent, mark as UNCERTAIN or record an explicit limitation.