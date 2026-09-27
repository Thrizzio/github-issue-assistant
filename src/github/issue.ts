import { GitHubClient } from "./client.js";

export interface IssueComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

export type CandidateConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface CandidateIdentifier {
  name: string;
  confidence: CandidateConfidence;
  reason: string;
  source: "title" | "body" | "inline_code" | "stack_trace" | "comment" | "keyword";
  kindHint?: "class" | "function" | "file" | "path" | "keyword" | "package";
}

export interface IssueEvidence {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  comments: IssueComment[];
  url: string;
  extractedCandidates: CandidateIdentifier[];
}

const COMMON_STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "cannot",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "its",
  "itself",
  "let",
  "me",
  "more",
  "most",
  "must",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "wasn't",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "with",
  "would",
  "you",
  "your",
  "yours",
  "yourself",
  "bug",
  "issue",
  "fix",
  "error",
  "fail",
  "failed",
  "failing",
  "reproduce",
  "expected",
  "actual",
  "steps",
  "please",
  "thanks",
  "hello",
  "hi",
  "problem",
  "help",
  "version",
]);

/**
 * Deterministically extracts candidate identifiers, symbols, filenames, and keywords from issue text.
 */
export function extractIssueCandidates(
  title: string,
  body: string,
  comments: IssueComment[] = [],
): CandidateIdentifier[] {
  const candidates = new Map<string, CandidateIdentifier>();

  function addCandidate(cand: CandidateIdentifier) {
    const key = cand.name.toLowerCase();
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, cand);
      return;
    }

    // Upgrade confidence if higher
    const rank: Record<CandidateConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (rank[cand.confidence] > rank[existing.confidence]) {
      candidates.set(key, cand);
    }
  }

  const combinedFullText = [title, body, ...comments.map((c) => c.body)].join("\n\n");

  // 1. Extract backtick identifiers: `identifier` (HIGH confidence)
  const backtickRegex = /`([^`\n]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickRegex.exec(combinedFullText)) !== null) {
    const val = match[1].trim();
    if (val.length >= 2 && val.length <= 100 && !COMMON_STOP_WORDS.has(val.toLowerCase())) {
      // Check if it's a file path
      if (/\.(ts|tsx|js|jsx|json)$/i.test(val) || val.includes("/")) {
        addCandidate({
          name: val,
          confidence: "HIGH",
          reason: `Exact file/path enclosed in backticks: \`${val}\``,
          source: "inline_code",
          kindHint: val.includes("/") ? "path" : "file",
        });
      } else if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*(\(\))?$/.test(val)) {
        const cleanName = val.replace(/\(\)$/, "");
        addCandidate({
          name: cleanName,
          confidence: "HIGH",
          reason: `Exact code identifier enclosed in backticks: \`${val}\``,
          source: "inline_code",
          kindHint: val.endsWith("()")
            ? "function"
            : /^[A-Z]/.test(cleanName)
              ? "class"
              : undefined,
        });
      } else {
        addCandidate({
          name: val,
          confidence: "MEDIUM",
          reason: `Code snippet in backticks: \`${val}\``,
          source: "inline_code",
        });
      }
    }
  }

  // 2. Extract stack traces and line pointers: e.g. at Foo.bar (src/foo.ts:42:10)
  const stackTraceRegex =
    /at\s+(?:([A-Za-z0-9_$]+)\.)?([A-Za-z0-9_$]+)\s+\((?:.*?[/\\])?([A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx)):(\d+)/g;
  while ((match = stackTraceRegex.exec(combinedFullText)) !== null) {
    const className = match[1];
    const methodName = match[2];
    const fileName = match[3];

    if (className) {
      addCandidate({
        name: className,
        confidence: "HIGH",
        reason: `Stack trace frame class identifier: ${className}`,
        source: "stack_trace",
        kindHint: "class",
      });
    }
    if (methodName && methodName !== "anonymous") {
      addCandidate({
        name: methodName,
        confidence: "HIGH",
        reason: `Stack trace frame method identifier: ${methodName}`,
        source: "stack_trace",
        kindHint: "function",
      });
    }
    if (fileName) {
      addCandidate({
        name: fileName,
        confidence: "HIGH",
        reason: `Stack trace source file: ${fileName}`,
        source: "stack_trace",
        kindHint: "file",
      });
    }
  }

  // 3. Extract PascalCase identifiers: e.g. RequestExecutor, UserSession (MEDIUM/HIGH)
  const pascalRegex = /\b([A-Z][a-zA-Z0-9]{2,})\b/g;
  while ((match = pascalRegex.exec(combinedFullText)) !== null) {
    const word = match[1];
    if (!COMMON_STOP_WORDS.has(word.toLowerCase())) {
      const inTitle = title.includes(word);
      addCandidate({
        name: word,
        confidence: inTitle ? "HIGH" : "MEDIUM",
        reason: inTitle
          ? `PascalCase identifier appearing in issue title: ${word}`
          : `PascalCase identifier appearing in issue body/comments: ${word}`,
        source: inTitle ? "title" : "body",
        kindHint: "class",
      });
    }
  }

  // 4. Extract function-like call syntax: e.g. executeRequest(), doRetry()
  const funcCallRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\s*\(/g;
  while ((match = funcCallRegex.exec(combinedFullText)) !== null) {
    const funcName = match[1];
    if (
      !COMMON_STOP_WORDS.has(funcName.toLowerCase()) &&
      !["if", "for", "while", "switch", "catch"].includes(funcName)
    ) {
      addCandidate({
        name: funcName,
        confidence: "HIGH",
        reason: `Explicit function call syntax: ${funcName}()`,
        source: "body",
        kindHint: "function",
      });
    }
  }

  // 5. Extract file paths: e.g. src/api/request.ts or tests/foo.test.ts
  const filePathRegex =
    /(?:^|\s|["'(])([a-zA-Z0-9_\-./]+\.(?:ts|tsx|js|jsx))(?::\d+)?(?:$|\s|["'),])/g;
  while ((match = filePathRegex.exec(combinedFullText)) !== null) {
    const rawPath = match[1].trim();
    if (rawPath.length >= 3 && !rawPath.startsWith("http")) {
      addCandidate({
        name: rawPath,
        confidence: "HIGH",
        reason: `Explicit file path mentioned in text: ${rawPath}`,
        source: "body",
        kindHint: rawPath.includes("/") ? "path" : "file",
      });
    }
  }

  // 6. Meaningful natural language keywords from title and body (LOW confidence)
  const words = combinedFullText.split(/[^a-zA-Z0-9_-]+/);
  for (const w of words) {
    const lower = w.toLowerCase();
    if (
      lower.length >= 4 &&
      !COMMON_STOP_WORDS.has(lower) &&
      !/^\d+$/.test(lower) &&
      !candidates.has(lower)
    ) {
      addCandidate({
        name: w,
        confidence: "LOW",
        reason: `Natural-language keyword from issue text: "${w}"`,
        source: "keyword",
        kindHint: "keyword",
      });
    }
  }

  return Array.from(candidates.values());
}

export class GitHubIssueService {
  constructor(private readonly client: GitHubClient) {}

  /**
   * Fetches an issue along with its comments and deterministically extracts candidate identifiers.
   */
  async fetchIssueEvidence(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueEvidence> {
    const octokit = this.client.getOctokit();

    try {
      // 1. Fetch main issue
      const issueRes = await octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      const issueData = issueRes.data;

      // 2. Fetch comments (up to 100)
      let comments: IssueComment[] = [];
      if (issueData.comments > 0) {
        try {
          const commentsRes = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
            per_page: 100,
          });

          comments = commentsRes.data.map((c) => ({
            id: c.id,
            author: c.user?.login ?? "unknown",
            body: c.body ?? "",
            createdAt: c.created_at,
          }));
        } catch {
          // If comments fetch fails, continue with empty comments list
          comments = [];
        }
      }

      const title = issueData.title ?? "";
      const body = issueData.body ?? "";
      const labels = (issueData.labels ?? [])
        .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
        .filter(Boolean);

      const extractedCandidates = extractIssueCandidates(title, body, comments);

      return {
        number: issueData.number,
        title,
        body,
        state: issueData.state,
        author: issueData.user?.login ?? "unknown",
        createdAt: issueData.created_at,
        updatedAt: issueData.updated_at,
        labels,
        comments,
        url: issueData.html_url,
        extractedCandidates,
      };
    } catch (err) {
      this.client.handleApiError(err, owner, repo, issueNumber);
    }
  }
}
