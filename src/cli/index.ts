#!/usr/bin/env node

import { Command } from "commander";
import { runInvestigate } from "./commands/investigate.js";

const program = new Command();

program
  .name("issuepilot")
  .description("Codebase Archaeology & Contributor Reconnaissance CLI")
  .version("1.0.0");

program
  .command("investigate")
  .description(
    "Investigates a GitHub issue inside a local repository and produces contributor context",
  )
  .argument("<issue-number>", "GitHub issue number to investigate")
  .option(
    "--repo <owner/repo>",
    "GitHub repository in owner/repo format (overrides Git remote detection)",
  )
  .option("--token <token>", "GitHub Personal Access Token (defaults to GITHUB_TOKEN env var)")
  .option("--no-llm", "Disable LLM synthesis and emit purely deterministic repository evidence")
  .option(
    "--output <path>",
    "Output path for the generated markdown report (defaults to .github/CONTRIBUTOR_CONTEXT.md)",
  )
  .option("--json", "Output the raw EvidenceGraph JSON to stdout")
  .option("--verbose", "Enable verbose debug logging")
  .action(async (issueNumberStr: string, options) => {
    await runInvestigate(issueNumberStr, {
      repo: options.repo,
      token: options.token,
      noLlm: options.llm === false,
      output: options.output,
      json: options.json,
      verbose: options.verbose,
    });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
