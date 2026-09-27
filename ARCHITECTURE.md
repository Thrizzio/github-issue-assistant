# Architecture: IssuePilot

## Status
Under Active Construction — Building production-quality CLI tool implementing `DETERMINISTIC ANALYSIS → EVIDENCE GRAPH → LLM SYNTHESIS`.

## Core Philosophy
1. **Deterministic Repository Truth**: The deterministic analysis engine is the single source of truth for repository facts (files, AST symbols, semantic references, Git history, churn, tests, impact).
2. **Strict LLM Boundary**: The LLM receives ONLY the verified `EvidenceGraph`, strict system prompts, and output schema. It never inspects arbitrary code or invents facts.
3. **Resilience**: If the target repo has TS errors, or the LLM is unavailable/fails, deterministic reconnaissance still succeeds.

## Modules

```
src/
├── cli/              # Commander.js CLI entrypoint, argument parsing, options
│   ├── index.ts
│   └── commands/investigate.ts
├── github/           # GitHub REST API client via @octokit/rest, issue & PR fetching
│   ├── client.ts
│   ├── issue.ts
│   ├── repository.ts
│   └── pullRequests.ts
├── repository/       # Local repository discovery, ts-morph AST & references, tests
│   ├── detector.ts   # Detects git repo, parses remotes (HTTPS/SSH)
│   ├── fileDiscovery.ts # Source indexing (.ts,.tsx,.js,.jsx) respecting gitignore/exclusions
│   ├── project.ts    # ts-morph Project management & compiler configuration
│   ├── symbols.ts    # AST symbol declaration matching & candidate extraction
│   ├── references.ts # Semantic references, call sites, fan-out calculation
│   └── tests.ts      # Test discovery, DIRECT vs CALLER classification, validation surface
├── archaeology/      # Git history analysis via safe child_process.execFile
│   ├── git.ts        # Git wrapper (log, log -S, blame, show, diff, rev-list)
│   ├── provenance.ts # Probable introducing commit and modifying commits
│   ├── churn.ts      # Time-windowed file churn and commit frequency
│   └── commits.ts    # Commit parsing and SHA/author/message metadata
├── impact/           # Impact profiling (fan-out, churn, test surface)
│   ├── profile.ts    # LOW/MEDIUM/HIGH categorical metrics with documented thresholds
│   └── metrics.ts    # Scoring constants and derivation rules
├── evidence/         # Strongly typed domain model & Zod runtime schemas
│   ├── schema.ts     # Zod EvidenceGraph schema
│   ├── builder.ts    # EvidenceGraph assembly and JSON serialization
│   └── validator.ts  # Runtime verification
├── synthesis/        # LLM integration layer
│   ├── provider.ts   # LLMProvider interface
│   ├── schema.ts     # ContributorBrief Zod schema
│   ├── prompt.ts     # Anti-hallucination prompt construction
│   └── synthesizer.ts# Synthesis coordinator with deterministic fallback
├── output/           # Presentation
│   ├── terminal.ts   # Chalk & Ora formatted terminal overview
│   └── markdown.ts   # .github/CONTRIBUTOR_CONTEXT.md report generator
├── config/           # Configuration loader (.issuepilotrc.json, env)
│   └── config.ts
└── utils/            # Shared utilities
    ├── paths.ts      # Cross-platform safe path normalization
    ├── logger.ts     # Logging with verbosity levels
    └── errors.ts     # Typed domain errors
```

## Data Flow
```
CLI Command (issuepilot investigate <issue-number>)
  │
  ├── 1. Repository & Remote Detection (detector.ts)
  │      └── Extracts owner/repo from git remote or --repo
  │
  ├── 2. GitHub Issue Fetching (github/issue.ts)
  │      └── Retrieves title, body, comments, labels, author, state
  │
  ├── 3. Issue Keyword & Symbol Extraction (issue.ts)
  │      └── Extracts quoted identifiers, stack traces, keywords with confidence
  │
  ├── 4. Source File Discovery (repository/fileDiscovery.ts)
  │      └── Discovers .ts, .tsx, .js, .jsx files (excluding node_modules, dist, etc.)
  │
  ├── 5. Semantic AST & Symbol Discovery (repository/symbols.ts via ts-morph)
  │      └── Finds functions, classes, interfaces, methods, variables, enums
  │
  ├── 6. Semantic References & Fan-Out (repository/references.ts)
  │      └── Computes semantic call sites and fan-out counts
  │
  ├── 7. Test Discovery (repository/tests.ts)
  │      └── Direct tests (imports target) vs Caller tests (exercises callers)
  │
  ├── 8. Git Archaeology & Provenance (archaeology/git.ts, provenance.ts, churn.ts)
  │      └── Probable introducing commit (git log -S), churn over time window
  │
  ├── 9. Impact Profile Calculation (impact/profile.ts)
  │      └── Reference fan-out, historical churn, validation surface → overall impact
  │
  ├── 10. EvidenceGraph Assembly & JSON Serialization (evidence/builder.ts)
  │       └── Emits .issuepilot/evidence/<id>.json
  │
  ├── 11. LLM Synthesis or Deterministic Fallback (synthesis/synthesizer.ts)
  │       └── Strict schema-guided synthesis; falls back gracefully if unavailable/--no-llm
  │
  └── 12. Report Generation (output/markdown.ts & terminal.ts)
          └── Emits .github/CONTRIBUTOR_CONTEXT.md and prints terminal summary
```

## Key Decisions
- [ADR 0001: Deterministic Evidence Graph Pipeline and TypeScript/ESM Foundation](file:///c:/DEV%20WORK/github%20issue%20assistant/docs/adr/0001-deterministic-evidence-graph-architecture.md)