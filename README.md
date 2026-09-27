# IssuePilot — Codebase Archaeology & Contributor Reconnaissance CLI

> **Deterministic Repository Analysis → Verified Evidence Graph → Structured Synthesis**

IssuePilot is a production-quality command-line tool that investigates a GitHub issue inside a locally cloned TypeScript/JavaScript codebase and produces an evidence-backed reconnaissance brief (`.github/CONTRIBUTOR_CONTEXT.md`).

Rather than passing raw repository files to an LLM and hoping it does not hallucinate, IssuePilot enforces a strict architectural boundary: **the local deterministic engine is the sole source of truth for repository facts**. The LLM operates purely as an evidence synthesis layer over a strongly typed `EvidenceGraph`.

---

## The Problem

Traditional AI coding assistants and agent wrappers routinely suffer from:

1. **Fabricated Call Graphs**: Guessing function callers and relationships without compiler verification.
2. **Imaginary History**: Hallucinating who wrote code, why it was introduced, or which PR added it.
3. **Ungrounded Confidence**: Presenting wild speculation with the same authority as verified facts.
4. **Context Window Waste**: Ingesting random files into token context instead of isolating relevant semantic symbols and references.

IssuePilot replaces heuristic guesswork with deterministic codebase archaeology.

---

## Architectural Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                 Deterministic Analysis Engine               │
│                                                             │
│  Git Detection ──► AST Indexing ──► Semantic References    │
│  (Remote/Repo)      (ts-morph)        (Call Sites/Fanout)   │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  Issue Metadata    Git Archaeology       Test Discovery     │
│  (Candidates)     (Pickaxe/Provenance)   (Direct vs Caller) │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │ Strongly Typed Domain     │
              │       EvidenceGraph       │
              │  (Zod Runtime Validation) │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │     Synthesis Layer       │
              │ (LLM or Deterministic)    │
              └─────────────┬─────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────┐
    │              Reconnaissance Output            │
    │  - .github/CONTRIBUTOR_CONTEXT.md             │
    │  - .issuepilot/evidence/<id>.json             │
    │  - Concise Terminal Summary (Chalk / Ora)     │
    └───────────────────────────────────────────────┘
```

### Deterministic vs. LLM Responsibilities

| Responsibility                              |   Deterministic Engine    |     LLM Synthesis Layer     |
| ------------------------------------------- | :-----------------------: | :-------------------------: |
| Extract issue identifiers and keywords      |    **Source of Truth**    |          Forbidden          |
| Parse Git remotes and verify HEAD           |    **Source of Truth**    |          Forbidden          |
| Index AST symbols, types, exports           |    **Source of Truth**    |          Forbidden          |
| Semantic reference and call site resolution |    **Source of Truth**    |          Forbidden          |
| Test discovery (direct vs. caller tests)    |    **Source of Truth**    |          Forbidden          |
| Git provenance (`git log -S`, churn)        |    **Source of Truth**    |          Forbidden          |
| Impact profile (fan-out, churn, tests)      |    **Source of Truth**    |          Forbidden          |
| Grounded problem interpretation             |      Evidence input       |   **Synthesis & Framing**   |
| High / Medium / Uncertain classification    | Explicit evidence tagging | **Structured Organization** |
| Suggested test scenarios                    |   Inputs test presence    |  **Scenario Formulation**   |

If the LLM fails, times out, or is disabled via `--no-llm`, **the deterministic analysis still completes fully and generates the report**.

---

## Supported Languages

In v1, IssuePilot provides deep semantic analysis for:

- **TypeScript** (`.ts`, `.tsx`)
- **JavaScript** (`.js`, `.jsx`)

_Note_: Non-JS/TS languages are intentionally excluded in v1 to ensure semantic compiler depth rather than shallow text parsing.

---

## Installation

### Prerequisites

- Node.js >= 18.0.0 (tested on Node 24)
- Git >= 2.30

```bash
# Clone the repository
git clone https://github.com/aadik13/issuepilot.git
cd issuepilot

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

---

## Authentication

IssuePilot queries GitHub's REST API for issue descriptions, comments, and commit PR associations.

Configure authentication via environment variable or CLI flag:

```bash
# Option 1: Environment variable
export GITHUB_TOKEN="ghp_your_token_here"

# Option 2: CLI option
issuepilot investigate 1842 --token "ghp_your_token_here"
```

_Security Note_: IssuePilot sanitizes output and never prints or logs tokens or authorization headers.

---

## Usage

### Basic Command

Inside any cloned repository:

```bash
issuepilot investigate <issue-number>
```

### CLI Options

```text
Usage: issuepilot investigate [options] <issue-number>

Investigates a GitHub issue inside a local repository and produces contributor context

Arguments:
  issue-number               GitHub issue number to investigate

Options:
  --repo <owner/repo>        GitHub repository in owner/repo format (overrides Git remote detection)
  --token <token>            GitHub Personal Access Token (defaults to GITHUB_TOKEN env var)
  --no-llm                   Disable LLM synthesis and emit purely deterministic repository evidence
  --output <path>            Output path for the generated markdown report (defaults to .github/CONTRIBUTOR_CONTEXT.md)
  --json                     Output the raw EvidenceGraph JSON to stdout
  --verbose                  Enable verbose debug logging
  -h, --help                 display help for command
```

### Examples

```bash
# Investigate issue 1842 using auto-detected origin remote
issuepilot investigate 1842

# Explicitly override the GitHub repository
issuepilot investigate 1842 --repo trpc/trpc

# Run purely deterministic analysis without LLM
issuepilot investigate 1842 --no-llm

# Custom report output location
issuepilot investigate 1842 --output ./CONTRIBUTOR_CONTEXT.md
```

---

## Terminal Output Example

```text
IssuePilot ── Contributor Reconnaissance

Issue #1842 Add retry support to GitHub API client

Archaeology
  Primary Symbol:   RequestExecutor
  Location:         src/api/request.ts:12
  Probable Origin:  7a31c2d (2024-06-01T00:00:00Z)
  References:       37 across 4 file(s)

Impact Profile
  Fan-out:            HIGH
  Churn:               MEDIUM
  Validation Surface:  LOW
  Overall Impact:      HIGH

Tests
  tests/api/request.test.ts

Output
  ✓ .github/CONTRIBUTOR_CONTEXT.md
```

---

## Configuration: `.issuepilotrc.json`

IssuePilot works out of the box with zero configuration. For customized thresholds or providers, create an optional `.issuepilotrc.json` file in your repository root:

```json
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-2.5-flash"
  },
  "analysis": {
    "churnMonths": 6,
    "maxRelevantSymbols": 20
  },
  "output": {
    "path": ".github/CONTRIBUTOR_CONTEXT.md"
  }
}
```

---

## EvidenceGraph Schema

Before synthesis, IssuePilot serializes an exact snapshot of what was discovered to:

```text
.issuepilot/evidence/<issue-number>.json
```

The graph contains:

- `issue`: Normalized title, body, comments, labels, author, and extracted candidates (with confidence levels).
- `repository`: Owner, name, remote, root directory, and current HEAD commit SHA.
- `symbols`: Located AST declarations (kind, file, line ranges, export status, semantic reference count, referencing files).
- `relationships`: Typed edges (`imports`, `calls`, `references`, `tests`).
- `provenance`: Historical introducing commits (`git log -S`), modifying commits, and PR associations.
- `validationSurface`: Direct tests vs. caller tests, with categorical validation surface.
- `impactProfile`: Reference fan-out, churn, and overall categorical impact.
- `limitations`: Diagnostic logs or AST warnings.

---

## Confidence Classification

Every major factual claim is categorized:

- **`HIGH_CONFIDENCE`**: Direct compiler AST match, semantic reference, or verified Git commit SHA.
- **`MEDIUM_CONFIDENCE`**: Structural inference (e.g. caller file relationship, probable origin via file history).
- **`UNCERTAIN`**: Ambiguous requirements or items not explicitly stated in repository or issue metadata.

The engine never silently converts uncertainty into certainty.

---

## Development & Testing

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
npm run format:check
```

### Building

```bash
npm run build
```

---

## Contributing

1. Fork and create a topic branch.
2. Ensure strict TypeScript types (`strict: true`, no unvetted `any`).
3. Maintain the deterministic invariant: `DETERMINISTIC ANALYSIS → EVIDENCE GRAPH → LLM SYNTHESIS`.
4. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run format:check` before submitting.

---

## License

[MIT](LICENSE) © 2026 IssuePilot Contributors
