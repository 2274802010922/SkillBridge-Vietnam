# ADR-004: Pinned sandbox off-ramp and durable recovery

Status: accepted

Date: 2026-09-18

## Context

The existing experiment mixed provider simulation with HTTP handlers, fell back
to the reward vault, and could acknowledge inserted-but-unapplied webhook events.
The owner authorized the sandbox adapter plan, not real-money operations.

## Decision

Keep only a sandbox adapter, immutable per-order funding/quote metadata, a dedicated
new-order settlement wallet, and DB-backed operation/inbox/signature journals.
Stored orders route by stored provider/mint, not current environment defaults.
Payout failure never erases finalized crypto. See [architecture](../../architecture/offramp.md)
for implementation and compatibility details rather than duplicating them here.

## Alternatives considered

- A credential-only production switch: rejected; no implemented/certified provider.
- Reusing reward custody: rejected for new orders; old funding destinations remain recoverable.
- Process-local locks/background timers: unsuitable for independent Vercel invocations.

## Consequences

Deployment needs an explicit dedicated public wallet and v2 webhook producers.
No automatic refund; exceptional deposits remain visible for operator reconciliation.
A real provider requires capability evidence, official authentication, idempotency
and operational approval before registration. Sandbox tests do not establish that readiness.

## Related files/docs

- [Runbook](../../testing/offramp.md)
- [Provider contract](../../../backend/services/cashout/providers/types.ts)
