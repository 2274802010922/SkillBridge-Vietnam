# Architecture Decision Records

ADRs capture durable choices and their consequences, not session progress or
copies of [architecture documentation](../../architecture/README.md).

Create one when deployment, custody/trust boundaries, data compatibility or a
cross-module contract changes. Small implementation details belong in code or
an [execution plan](../plans/README.md).

Copy [ADR_TEMPLATE](ADR_TEMPLATE.md) to `ADR-NNN-short-title.md`, using the next
unused number. Use proposed, accepted, rejected or superseded status; record the
date. An accepted record requires a supported decision, not an agent's guess.
For retrospective records, identify the source commits and distinguish recording
date from the original decision date. Unknown rationale stays unknown.

Preserve the meaning of accepted decisions. A replacement gets a new ADR and
the old record links to it as superseded. Correct factual errors transparently.
No need to convert every historical design document into an ADR.

## Records

- [ADR-001: Repository-owned context](ADR-001-repository-context.md)
- [ADR-002: Escrow and legacy custody boundary](ADR-002-escrow-compatibility.md)
- [ADR-003: Evidence portfolios and journaled issuance](ADR-003-evidence-portfolios.md)
- [ADR-004: Pinned sandbox off-ramp and durable recovery](ADR-004-offramp-sandbox-boundary.md)
