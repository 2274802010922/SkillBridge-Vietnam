<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SkillBridge repository map

- `app/` contains Next.js route/layout adapters. Keep existing URLs stable.
- `frontend/` contains UI, shared components, i18n and styles.
- `backend/` contains HTTP handlers, auth, AI, services, database and storage.
- `solana/` contains Anchor programs, IDL and chain integrations.
- `shared/` contains pure validation/data; no server runtime dependencies.
- `tooling/` preserves optional legacy tools and archived agent instructions.

Current interface guidance: `docs/design/system.md`.
Deployment: Next.js on Vercel from the repository root.
Do not use archived K95/motion skills as the active product design.

After moving files, run `npm run check:repo`, `npm run lint` and `npm test`.
Never rename migration identifiers or expose server code through frontend runtime imports.

## Session bootstrap

Harness home: [docs/harness](docs/harness/README.md).

For non-trivial work, restore context from the repository before editing:

1. Read this file, then [Current Project State](docs/harness/context/CURRENT_STATE.md).
2. Use the [documentation index](docs/README.md) to select task-relevant guides.
3. Check [active plans](docs/harness/plans/active/) and read the matching plan, if any.
4. Read the affected module's README and any nested `AGENTS.md` before changing it.
   For chain-related work, explicitly read [Solana instructions](solana/AGENTS.md),
   even when starting from a backend handler or the standalone verifier.
5. Check `git status --short`, staged/unstaged diffs, and recent commits when
   continuing existing work. Preserve unrelated changes; do not assume a clean tree.
6. Inspect the relevant implementation and tests before changing behavior.

If documentation conflicts with implementation, do not silently guess. Establish
the behavior using code, tests and Git history; correct stale docs and report any
unresolved conflict. Stored evidence is dated proof, not a fresh runtime check.

## Session handoff

After a substantial task or before ending a long workstream:

- Update `CURRENT_STATE.md` only when project state materially changes.
- Update the relevant execution plan with completed/remaining work, exact files,
  blockers, validation outcomes and the next concrete step. Move finished plans
  to `docs/harness/plans/completed/`; do not mark unfinished work complete.
- Record durable architecture decisions through [ADRs](docs/harness/decisions/README.md).
- Update `CHANGELOG.md` for notable changes, linking rather than duplicating details.
- Follow [the handoff checklist](docs/harness/context/HANDOFF.md). Record failed/skipped
  checks honestly. Commit/push only when authorized for the current task.
- Never store conversation transcripts, credentials, private evidence or local
  machine configuration in context files.

## Context discipline

The repository is the durable source of truth; conversation is temporary working
memory and must not override newer verified repository facts.

- Load progressively: state → index → relevant plan/docs → module → code/tests.
  A small UI edit does not require the Solana runbook; a program edit does not
  require the complete design documentation.
- Do not scan the whole repository blindly, assemble giant context files or
  duplicate authoritative documentation. Prefer links to the owning guide.
- Historical/completed plans describe past intent, not current runtime behavior.
  Use [plan guidance](docs/harness/plans/README.md) for multi-step work, not trivial edits.
- Keep snapshots concise and dated. Unknown active work stays explicitly unknown;
  do not invent a roadmap from old TODOs or assume unrun checks passed.
