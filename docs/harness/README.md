# Repository harness

Persistent project context lives here. Start with [CURRENT_STATE](context/CURRENT_STATE.md),
then use the [project documentation index](../README.md) to load only task-relevant guides.

| Directory | Purpose |
| --- | --- |
| [context/](context/) | Current checkpoint and [session handoff](context/HANDOFF.md) |
| [plans/](plans/README.md) | Template, [active work](plans/active/) and [completed plans](plans/completed/) |
| [decisions/](decisions/README.md) | Architecture decisions and ADR template |

Existing architecture/product/module guides remain in their original locations;
this harness links to them instead of copying them.

Two instruction entry points intentionally stay outside this folder:
[root AGENTS.md](../../AGENTS.md) and [solana/AGENTS.md](../../solana/AGENTS.md).
They route sessions here while retaining repository/module scope.
Validation stays with existing tooling: [checker](../../scripts/check-repo.mjs)
and [regression tests](../../tests/tooling/repo-harness.test.mjs).

No runtime memory service, dependency, credentials or conversation transcript is required.
