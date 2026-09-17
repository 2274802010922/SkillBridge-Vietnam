# ADR-003: Versioned evidence portfolios and journaled issuance

Status: accepted
Date: 2026-09-17

## Context

The approved evidence-to-opportunity scope needs reusable profiles without silently
sharing private submissions, and credential recovery without relying on one request
finishing its chain and database work together.

## Decision

- Store immutable pack versions with source references/hashes, not copies of raw files.
- Public publication points to an explicit version; private grants bind an application
  and organization. Review-summary reuse requires organization permission as well as
  the subject's explicit sharing/AI consent. Private targets remain owner-only.
- Recheck permissions before cached AI results. Drafts never change official reviews,
  credentials or payments. Only explicitly selected OpenRouter is used for career drafts.
- Reserve issuance capacity with a conditional DB write; journal signed bytes before
  broadcast, and reconcile finalized accounts before committing the credential record.
- Launch trials are server-issued and do not charge money or restrict existing core rights.

## Alternatives considered

Mutable shared profiles obscure what was submitted; blanket file access violates
existing privacy boundaries. Browser-only quota/locks do not coordinate Vercel
instances. Blind transaction retries cannot distinguish a failed response from a
successful chain write. Real billing and new freelance escrow are outside this release.

## Consequences

No new runtime dependency or Anchor deployment. More additive tables and permission
checks are required. Downloads cannot be remotely revoked. Unknown transaction states
can require operator review; safety is preferred to releasing uncertain capacity.
Citation validation establishes source presence, not semantic correctness or job readiness.

## Related files/docs

[Operation guide](../../testing/evidence-portfolios.md) ·
[Portfolio service](../../../backend/services/portfolios/packs.ts) ·
[Issuance service](../../../backend/services/credentials/issuance.ts)
