# ADR-001: Repository-owned persistent context

Status: accepted
Date: 2026-09-16

## Context

The repository already has module guides, architecture docs, CI and tests.
The requested harness must let a fresh Codex session resume without old chat.

## Decision

Use Markdown + Git: concise current snapshot, temporary execution plans and
durable ADRs, routed by AGENTS and the docs index. Existing subsystem guides
remain authoritative for detail. Add lightweight checks to the existing checker.

Keep context, plans and ADRs together under `docs/harness/`, as requested in the
owner's consolidation follow-up. Root/module AGENTS remain scoped entry points;
checker/test integration remains in the existing tooling directories.

## Alternatives considered

- Conversation-only state loses decisions between sessions.
- A monolithic context file duplicates docs and increases bootstrap cost.
- A memory service/vector database adds dependencies unnecessary for this scope.

## Consequences

No runtime or deployment change. Agents must maintain checkpoints and verify
stale claims; link checks cannot establish factual freshness. Uncommitted state
is only available in that checkout until shared through Git.

## Related files/docs

[AGENTS](../../../AGENTS.md) · [Handoff](../context/HANDOFF.md) ·
[Plans](../plans/README.md) · [Repository checker](../../../scripts/check-repo.mjs)
