# Demo reliability — release and acceptance

Updated: 2026-09-21. Scope: [plan](../harness/plans/active/2026-09-20-demo-reliability.md).
Findings: [audit](demo-audit-2026-09-20.md). This document separates implementation
from deployment and real-wallet acceptance.

## Implemented changes

| Finding | Implementation |
| --- | --- |
| F01–F04 | Shared role/deadline reward progress; inline refresh feedback; operation postconditions; program receipt state on payouts |
| F05 | Official draft hash + committed minimum score before eligible result/allocation |
| F06 | JSON errors, bounded request wrapper, action busy cleanup |
| F07 | Existing escrow immutability triggers preserved; conditional file writes and Blob byte/hash validation added |
| F08 | Deterministic issuer/schema inspection and durable bootstrap step recovery |
| F09 | Immutable milestone intent, atomic signature claims, finalized verification and replay rejection |
| F10–F11 | OpenRouter failure categories, remaining time budget, invalid-cache rejection and actual assessment ID |
| F12 | Markdown MIME fallback and bounded Blob metadata confirmation |
| F13 | Escrow refresh backoff/in-flight guard and stale-selection guards |
| F14 | Session wallet matching and signed-byte recovery; no unconditional clearing of uncertain payments |
| F15 | Behavioral regression tests and corrected reviewer-consent/deadline demo scripts |
| F16 | Partial cashout load errors preserve prior data with a stale warning |

The contract program, IDL, existing PDA seeds and existing challenge terms are unchanged.
A passing grade is distinct from an allocated award. Both reviewer wallets must
accept before publication. Backup takes over exclusively after the review deadline.

## Schema and deployment

Migration `0022_demo_reliability.sql` is additive and mirrored by runtime schema
initialization. It introduces milestone intents/signature claims, issuer bootstrap
steps and escrow operation expectations. No old migration was renamed.

Existing milestone signatures are checked before accepting a new claim. Conflicting
legacy records remain intact and return a reconciliation error; migration does not
silently pick a winner or fail by creating a unique index over dirty old rows.
Legacy milestones have a constrained sender/recipient/mint/amount verification path
when no reference was stored. New payments must use the saved intent/reference.

Deploy from the repository root on Vercel. No new environment variable is required.
Keep existing Turso, private Blob, Devnet RPC, signer and AI configuration.
Runtime schema creation requires the database privileges already used by the app.

## Local verification

- 2026-09-21: production build/TypeScript + **184/184 tests passed**.
- Lint, repository validation and diff checks passed before publication.
- Additional tests cover official score thresholds, reviewer handover boundaries,
  operation-specific sync, unavailable transaction history, wrong operation payload,
  paid escrow views, issuer recovery, milestone replay, MIME and AI errors.
- HTTP tests use an isolated database and controlled RPC. They do not prove a new
  live transfer, a physical wallet signature, real AI availability or Blob callback.
- Browser QA uses an isolated fixture session with local RPC and no provider secrets.
  Refresh feedback and next-step guidance inspected in VI/EN at 375/768/1024/1440px;
  no horizontal overflow or console error observed. Physical wallets are not installed
  in this fixture context, so signature prompts were not a live-wallet acceptance.

## Owner-run Vercel acceptance after deployment

1. Confirm the deployment points at the release commit.
2. Use a new test challenge with deadlines allowing funding, both consent signatures
   and student registration. Set review deadline at least 30 minutes after submission
   deadline for rehearsal. Times are fixed when configured, not reset at publication.
3. Funder deposits; primary and backup each accept; funder publishes.
4. Student uploads Markdown or PDF, saves and signs the submission.
5. Reviewer saves the official grade. After submission deadline, the active reviewer
   records the result and allocates an award. The UI identifies the required wallet.
6. Student claims; refresh Payouts and submission progress. Both must show paid.
   Repeat checks and reload; they must not create another transfer.
7. Independently inspect the escrow/receipt and Explorer transaction.
8. Test issuer bootstrap/credential issuance recovery and one optional live AI call.
9. Upload a file above 4 MB and wait for Blob metadata confirmation.
10. Verify a sandbox cashout; VND remains simulated. Validate milestone submit,
    approve, pay and signature recheck; the same signature cannot pay another milestone.
11. Repeat the core demo once, including a deliberate reload after signing.
    Use Phantom and one other available Wallet Standard wallet.

For the earlier short challenge, read the current chain state first; its September 19
review deadline means the backup wallet is required. Do not deposit again for recovery.
The older long challenge remains subject to its original September 25 submission deadline.

## Outstanding external checks

Authenticated Vercel acceptance, live OpenRouter, real Blob completion callbacks,
physical mobile wallets and new live Devnet payout proofs are not recorded by this
release's local checks. No program upgrade or mainnet transaction is part of this release.
