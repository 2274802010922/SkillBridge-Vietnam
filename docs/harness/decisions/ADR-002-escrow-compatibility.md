# ADR-002: Preserve program escrow and legacy custody boundaries

Status: accepted
Date: 2026-09-16

Retrospective record of existing behavior in `291a235` and `cb64ee7`, verified
against `b510897`; this date records the ADR, not a new protocol decision.

## Context

Existing shared-vault records coexist with newer program-controlled rewards.
Changing custody or timeout policy would affect funds and signed commitments.

## Decision

New monetary challenges use Devnet program escrow; existing legacy funds/badge
bonds keep their path. Do not silently migrate funds or reset records. Preserve
the explicit stalled-review policy: unresolved funds wait if neither reviewer
acts, without automatic refund or replacement. Full rules remain in the
[product contract](../../product/proof-to-payout.md) and [runbook](../../solana/escrow-runbook.md).

## Alternatives considered

The product contract explicitly excludes automatic timeout refunds/replacement.
No broader historical alternatives analysis is recorded; none is inferred here.

## Consequences

Maintain compatibility and distinguish legacy vaults from escrow in UI/verification.
Funds can remain locked indefinitely. Program upgrade authority is still a trust
assumption; independent allocated claims do not make all product operations trustless.

## Related files/docs

[Escrow program](../../../solana/programs/challenge_escrow/src/lib.rs) ·
[Escrow store](../../../backend/services/escrow/escrow-store.ts) ·
[Legacy journal](../../../solana/server/legacy-vault-journal.ts) ·
[Contract tests](../../../tests/solana/escrow-contract.test.ts)
