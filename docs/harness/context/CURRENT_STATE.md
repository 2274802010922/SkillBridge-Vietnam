# Current Project State

State reviewed: 2026-09-21; reliability implementation commit `7cdbe72`.
This is a short checkpoint, not a deployment report. Recheck Git before continuing.

## Current objective

Maintain the UniHackFest proof-to-opportunity flow: funded challenge → committed
submission → human decision → claimable reward/credential → another employer.
Latest release: [evidence portfolios](../../testing/evidence-portfolios.md), employer
comparison, career drafts and recoverable issuance. Handoff stays in [docs/harness](../README.md).
Latest addition: recoverable sandbox off-ramp; [publication checkpoint](../workstreams/offramp/handoff.md).

## Product state

- VI/EN workspace, wallet profiles, public/invitation-only challenges and draft editing.
- Private evidence, independent manual review, optional AI drafts and citation reader.
- Devnet program escrow, visible fund proofs, submission progress, independent
  wallet verification/allocated claims, optional fee sponsorship and applications.
- [Product contract](../../product/proof-to-payout.md) defines the trust boundaries;
  invoices and sandbox VND cashout are supporting experiments, not the core proof.

## Recently completed

- Legacy `/app/escrow` recovery now checks transaction finalization before re-reading
  the escrow account. A delayed first RPC snapshot no longer strands a successful
  `Initialize + Fund` transaction in the UI; rendered route regression is covered.

- Self-contained English/Vietnamese README with current UI gallery, Demo Day path,
  evidence matrix and architecture links; detailed Mermaid architecture diagrams are
  in [docs/architecture](../../architecture/README.md).

- Pinned off-ramp adapter, dedicated settlement address, immutable test quote and
  replay-safe journals; partial/late deposits retain proof for reconciliation.
  [Off-ramp architecture](../../architecture/offramp.md), [setup guide](../../testing/offramp.md).

- Versioned evidence packs, explicit sharing/revocation and reviewer summary permissions.
- Employer comparison/private notes; cited OpenRouter career drafts and server-side trials.
- Atomic issuance reservation and finalized chain-to-DB recovery; no Anchor upgrade.
- Beginner wallet install/create/connect guide, safe mobile handoff and discovery recovery.
- Wallet connection/signature/session feedback and matching-wallet disconnect.
- Credential applications, progress timeline, hash-bound citations and sponsored claims.
- Wallet-only verification and fund links; [context harness](../plans/completed/2026-09-16-repository-harness.md).
  Release details: [CHANGELOG](../../../CHANGELOG.md).

## In progress

[Demo reliability](../plans/active/2026-09-20-demo-reliability.md) implementation
is committed and awaiting external acceptance. It addresses the audited reward,
error handling, upload, issuer, milestone and AI paths without a program upgrade.
[Handoff](../workstreams/demo-reliability/handoff.md) records validation and remaining
live checks. The plan stays active until owner-run Vercel/wallet acceptance is recorded.

## Next priorities

Redeploy the reliability release, then follow [acceptance](../../testing/demo-reliability-acceptance.md).
No additional env variable is needed; migration 0022 is additive. Confirm the active
reviewer at the actual deadline, both consents, committed score and paid receipt.
F07 audit was corrected: baseline triggers already protected locked escrow files.

Off-ramp: owner configures the dedicated public wallet and performs post-deploy
acceptance from its runbook. No real provider/corridor or production access is established.

[Competition runbook](../../testing/competition-upgrades.md): owner-run live OpenRouter,
funded live USDC sponsorship and post-deploy role checks remain to be verified.
Wallet install/signing on physical phones remains [manual acceptance](../../testing/wallet-onboarding.md).
These gaps do not authorize deployments, spending or new features.

## Important decisions

- One Next.js/Vercel deployment; route/UI/server/pure-shared boundaries follow
  [architecture](../../architecture/README.md).
- Local SQLite / Turso via the D1-compatible adapter. Runtime schema and migration
  history coexist; never rename migration IDs.
- Wallet Standard + SIWS creates an HttpOnly server session; backend memberships
  enforce roles. Wallet connection alone grants no access.
- Devnet program escrow for new monetary challenges; legacy funds stay separate.
  No automatic stalled-review refunds/replacement. [Custody ADR](../decisions/ADR-002-escrow-compatibility.md).
- Manual scoring is independent. Multiple providers remain supported; OpenRouter
  requires an explicit model, strict output, no automatic fallback. [AI/cache rules](../../deployment/openrouter.md).
- Private files stay off-chain; locked submission versions cannot be rewritten.
  Citations bind to file ID/hash; AI cannot approve, allocate or pay.
- New cashout orders never reuse the reward vault. Old orders retain stored funding
  snapshots; production config fails closed. [Off-ramp ADR](../decisions/ADR-004-offramp-sandbox-boundary.md).

## Known issues / limitations

- No mainnet/audit claim; program upgrade authority still exists.
- Launch trials do not charge money. Live career AI/real-wallet acceptance remain pending.
- RPC uncertainty keeps issuance recoverable; failed/mismatched operations need operator review.
- Opportunity gate stores verifier-authorized receipts; fresh SAS checks run in
  the service, not the program. Stalled review can lock funds indefinitely.
- Scanned/unsupported documents need manual inspection; legacy unbound citations
  show warnings. VND settlement is sandbox, not real bank payout.
- `.openai/hosting.json` is retained [legacy Sites metadata](../../../tooling/legacy-sites/README.md),
  not a current second deployment. Old planning TODOs are not a backlog.

## Important entry points

- [Docs index](../../README.md) → task guide and module README.
- [Auth](../../../backend/auth/auth.ts), [provider selection](../../../backend/ai/provider-selection.ts),
  [runtime schema](../../../backend/database/schema/core-schema.ts).
- [Chain instructions](../../../solana/AGENTS.md), [escrow client](../../../solana/client/challenge-escrow.ts),
  [standalone verifier](../../../tools/claim-verifier/), [test guide](../../testing/README.md).

## Validation status

2026-09-21 reliability release: production build/TypeScript and 184/184 tests passed.
Browser fixture refresh feedback and VI/EN next steps checked at 375/768/1024/1440px,
no horizontal overflow. External live signing/AI/Blob/deployed acceptance remains pending.

2026-09-20 audit: production build + 168 tests, lint and repository checks passed.
Additional isolated HTTP/RPC probes reproduced below-threshold reward eligibility,
missing paid-escrow state on payouts, account-exists/funded conflation, text/JSON
error mismatch and one signature paying two milestone records. Read-only Devnet
confirmed both reported funds; the short demo challenge is now backup-reviewer-only.
No live signing, deployed authenticated session, live AI or Blob callback acceptance.

2026-09-18: standard `npm test` (production build + 168 tests), lint, repository check,
TypeScript and diff check passed. Off-ramp HTTP/RPC fixtures and VI/EN reconciliation
view at 375/768/1024/1440px passed; no new live transfer or bank payout.

2026-09-17: `check:repo`, lint, TypeScript and `git diff --check` passed;
`npm test` passed (production build + 151 tests). Chrome QA covered portfolio/comparison
VI/EN at 375/768/1024/1440px with mock AI/RPC. See the completed plan for scope.
No new live AI/Devnet transfer, Rust build, Vercel deployment or physical-wallet QA.

## Recent relevant commits

- `7cdbe72` — demo reliability: reward guidance, eligibility, issuer/payment recovery, 184-test suite.

- `91198d6` — pinned sandbox off-ramp, durable recovery, pre-sign inspection and 168-test regression.

- `d8615d1` — evidence portfolios, career AI, employer comparison and issuance recovery.
- `b510897` — wallet connection/session UX.
- `3c16444` — beginner wallet onboarding and recovery guidance.
- `2739e09` — applications, progress, citations, sponsored rewards and evidence.
- `04fe73d` — wallet lookup and visible fund proofs.
- `cb64ee7` — independent verification/claim and OpenRouter assistance.
- `e7a95c9` — current module separation and repository checks.
