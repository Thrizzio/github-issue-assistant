# 0001. Deterministic Evidence Graph Pipeline and TypeScript/ESM Foundation

## Status
Accepted

## Context
IssuePilot is a command-line tool designed to investigate a GitHub issue inside a locally cloned TypeScript/JavaScript codebase and produce an evidence-backed reconnaissance brief (`CONTRIBUTOR_CONTEXT.md`).
Traditional AI coding tools often feed raw issue descriptions and loose context windows to LLMs, resulting in fabricated file paths, imaginary call hierarchies, and hallucinated root causes.
IssuePilot must strictly enforce the invariant:
`DETERMINISTIC ANALYSIS → EVIDENCE GRAPH → LLM SYNTHESIS`
The LLM must never discover facts that the deterministic engine can verify; it solely interprets verified facts. Additionally, the system must function end-to-end even if the LLM provider fails or if `--no-llm` is specified.

## Decision
1. **Module System & Runtime**:
   - Use Node.js (>=18, tested on Node 24) with native ESM (`"type": "module"`).
   - Use TypeScript with `NodeNext` module resolution and `strict: true`.
2. **Analysis Stack**:
   - Use `ts-morph` for TypeScript compiler semantic analysis (AST, symbol resolution, cross-file references, type aliases, classes, interfaces, call sites). Reject Tree-sitter for v1 because Tree-sitter cannot perform semantic type-checker-backed symbol cross-references.
   - Use raw `child_process.execFile` for Git operations without shell interpolation to prevent command injection and parsing issues.
   - Use `@octokit/rest` for authenticated or public GitHub API queries.
   - Use `zod` for runtime validation and static type inference of the `EvidenceGraph` domain models.
3. **Pipeline Boundaries**:
   - Pipeline stages:
     1. Repository & Remote Detection (`detector.ts`)
     2. GitHub Issue Ingestion (`github/issue.ts`, `github/comments.ts`)
     3. Issue Keyword & Symbol Candidate Extraction (`issue.ts`)
     4. Source File Discovery (`fileDiscovery.ts` respecting exclusions & .gitignore)
     5. Semantic AST & Symbol Resolution (`ts-morph` project in `symbols.ts`, `references.ts`)
     6. Test Discovery & Classification (`tests.ts`: DIRECT vs CALLER tests, validation surface)
     7. Git Archaeology & Provenance (`archaeology/git.ts`, `provenance.ts`, `churn.ts`)
     8. Impact Profiling (`impact/profile.ts`: fan-out, churn, validation surface)
     9. EvidenceGraph Construction & Serialization (`evidence/builder.ts`, `.issuepilot/evidence/<id>.json`)
     10. Synthesis Layer (`synthesis/provider.ts`, `synthesis/synthesizer.ts`)
     11. Markdown & Terminal Presentation (`output/markdown.ts`, `output/terminal.ts`)
4. **Resilience Invariants**:
   - If TypeScript compiler reports compilation errors in the target codebase, the investigation records limitations but does not crash.
   - If the LLM provider fails, times out, or lacks credentials, the deterministic investigation still completes and emits `CONTRIBUTOR_CONTEXT.md` with deterministic evidence clearly labeled.

## Alternatives Considered
- **Tree-sitter**: Faster syntactic parsing, but lacks semantic reference resolution and cross-file type-checker awareness.
- **Direct LLM Agentic Search**: Having an LLM run commands or grep freely. Rejected because it violates the core philosophy that the deterministic engine must be the sole source of truth for repository facts.
- **SQLite Database for Cache**: Unnecessary complexity for v1; filesystem JSON caching is sufficient.

## Consequences
- Requires valid Node.js and TypeScript environment.
- High reliability and reproducibility: all claims in generated markdown link directly to source files, lines, Git commits, or issue comments.
- Zero risk of hallucinating nonexistent files or call graphs.
