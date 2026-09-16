# Repository context harness

Status: completed
Updated: 2026-09-16
Baseline: `b510897`, initially clean `main` working tree

Consolidation follow-up baseline: `e70d4fe`, fast-forwarded to preserve the owner's
three subsequent member-file deletions; no overlapping product changes.

## Goal

Fresh sessions restore verified SkillBridge context through repository files.
Acceptance: concise bootstrap, actionable handoff, separated plan/ADR lifecycles,
checker regression coverage and successful local validation without product changes.

## Context

Surveyed root/module READMEs, AGENTS, architecture/index, CHANGELOG, package scripts,
tests, CI/templates, retained Sites metadata, both diffs and 25 recent commits.
Cross-checked auth/session, AI provider/cache, database adapter/locks, escrow/gate,
standalone build and integration fixtures. No unfinished product feature confirmed.

## Constraints

Preserve Next.js generated instructions, module boundaries, migrations and user
files. No dependencies, product behavior, deployments or transactions.
Initially commit/push was excluded; the owner's follow-up explicitly authorized
consolidating the harness and committing/pushing the complete changes.

## Decisions

- [ADR-001](../../decisions/ADR-001-repository-context.md) owns context placement.
- Add only Solana-local AGENTS: hand-coded codecs and custody rules warrant it.
  Frontend/backend/shared rules already live in root instructions/module READMEs.
- Do not treat old product TODOs or historical live receipts as current active work.

## Completed

- Survey; checkpoint, handoff, plan/ADR templates and routing instructions.
- Retrospective escrow boundary ADR linked to existing contract/runbook.
- Lightweight checker invariants and isolated positive/negative regression fixtures.
- Reviewed progressive bootstrap, document ownership, snapshot length, Next.js block
  preservation and historical/live evidence distinctions; no runtime changes.
- Local validation and final link/diff review completed; snapshot records outcomes.
- Follow-up: grouped all harness documentation under `docs/harness/`, retaining
  scoped AGENTS entry points and existing tooling/test locations; updated all links.

## In progress

None.

## Remaining

None within harness scope. Existing live product checks remain explicitly outside scope.

## Relevant files

[AGENTS](../../../../AGENTS.md), [snapshot](../../context/CURRENT_STATE.md),
[handoff](../../context/HANDOFF.md), [docs index](../../../README.md),
[Solana rules](../../../../solana/AGENTS.md),
[checker](../../../../scripts/check-repo.mjs), [fixtures](../../../../tests/tooling/repo-harness.test.mjs).

## Known issues

Existing live OpenRouter and USDC sponsorship gaps are outside this maintenance
scope; no production feature is being declared newly verified.

## Validation

2026-09-16, Windows / Node 24.16.0 / npm 11.13.0, baseline plus this local patch:

- `npm run check:repo`: passed; 264 source modules and 42 Markdown files after consolidation.
- `node --test tests/tooling/repo-harness.test.mjs`: 6 passed, including negative fixtures.
- `npm run lint`: passed.
- `npm test`: production build and 122 tests passed (116 existing + 6 harness).
- `git diff --check`: passed; Git's LF/CRLF notices are not whitespace errors.
- Next.js generated AGENTS block unchanged; dependency versions/lockfile unchanged.
- Not run: live AI, Devnet transfers, Rust/SBF/local validator, Vercel deployment
  or browser QA. No product/runtime change requires those for this harness task.
  This validation does not close their existing product verification gaps.

## Handoff notes

No active product feature inferred. Commit/push is now authorized by the follow-up;
Git history/remote state, not this plan, records whether publication has completed.
Start a new task from CURRENT_STATE and the docs index, not this historical plan.
