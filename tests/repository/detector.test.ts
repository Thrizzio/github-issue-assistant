import { describe, expect, it } from "vitest";
import { parseGitHubUrl } from "../../src/repository/detector.js";
import { GitRemoteError } from "../../src/utils/errors.js";

describe("parseGitHubUrl", () => {
  it("parses owner/repo slug directly", () => {
    const res = parseGitHubUrl("trpc/trpc");
    expect(res).toEqual({ owner: "trpc", repo: "trpc" });
  });

  it("parses HTTPS remote URL with .git suffix", () => {
    const res = parseGitHubUrl("https://github.com/facebook/react.git");
    expect(res).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses HTTPS remote URL without .git suffix", () => {
    const res = parseGitHubUrl("https://github.com/vercel/next.js");
    expect(res).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("parses SSH remote URL with .git suffix", () => {
    const res = parseGitHubUrl("git@github.com:microsoft/TypeScript.git");
    expect(res).toEqual({ owner: "microsoft", repo: "TypeScript" });
  });

  it("parses SSH protocol URI", () => {
    const res = parseGitHubUrl("ssh://git@github.com/fastify/fastify.git");
    expect(res).toEqual({ owner: "fastify", repo: "fastify" });
  });

  it("parses HTTPS URL with user token credentials", () => {
    const res = parseGitHubUrl("https://user:token123@github.com/nodejs/node.git");
    expect(res).toEqual({ owner: "nodejs", repo: "node" });
  });

  it("throws GitRemoteError for non-GitHub URLs", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/owner/repo.git")).toThrow(
      GitRemoteError,
    );
  });

  it("throws GitRemoteError for invalid string", () => {
    expect(() => parseGitHubUrl("not-a-valid-url")).toThrow(GitRemoteError);
  });
});
