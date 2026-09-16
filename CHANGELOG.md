# Changelog

Notable project changes. Git history remains the detailed record.

## 2026-09-16 — Beginner wallet onboarding

- Optional VI/EN install/create/connect guide with official Phantom/Solflare downloads.
- Device-specific help, wallet rediscovery and clear cancellation feedback without changing SIWS.
- Safe same-origin mobile handoff preserving language and internal return destination.
- Compact mobile auth layout and regression coverage; physical-device installation/signing
  remains an explicit [manual check](docs/testing/wallet-onboarding.md).

## Unreleased — Repository context harness

- Add a concise current checkpoint, execution-plan lifecycle, ADRs and session handoff.
- Group persistent context documentation under `docs/harness/` with one entry index.
- Extend AGENTS routing while preserving Next.js instructions; add Solana-specific invariants.
- Validate required context files and plan state/location through the existing checker,
  with isolated regression fixtures. No product behavior or deployment changes.

## 2026-09-16 — Connect wallet

- Consistent Connect wallet / Disconnect terminology across Vietnamese and English UI.
- Distinct connection, signature and verification feedback for entering the workspace.
- Session revocation before a best-effort disconnect of the matching Wallet Standard connection.

## 2026-09-15 — From proof to opportunity

- Credential-based applications with business/university issuers, deadlines, consent-scoped snapshots and current-status rechecks.
- Submission progress covering official assessment, allocation, claim and credentials.
- File-ID/hash-bound citation navigation, PDF page access, extracted-text highlighting and recorded human score adjustments.
- Budgeted Devnet claim sponsorship with exact-message co-signing and transaction recovery.
- Live SOL sponsorship and credential-revocation evidence; live OpenRouter validation remains the owner's final manual check.
- Refreshed English/Vietnamese README with product journey, architecture, screenshots and inspectable evidence.

## 2026-09-11 — Wallet-first verification

- Address-only lookup, optional wallet connection, active badge counts and reward history.
- Shareable wallet links/QR and prefilled fund links from challenge details.
- Finalized fund totals, visible escrow addresses and labeled legacy shared vaults.
- Vietnamese/English lookup UI with technical controls under Advanced checks.
- Optional public title lookup; RPC failures remain distinct from empty results.

## 2026-09-09 — Independent proof-to-payout

- Standalone Devnet claim and SAS issuer-policy verifier, separately hostable.
- Downloadable terms, submission and approved-result commitments.
- OpenRouter structured output, optional brief/feedback assistance and generation locks.
- AI evidence stays separate from immutable submission evidence.
- No automatic refund or replacement when both reviewers fail to act.
- Recipient-only SOL Devnet claim verified finalized; OpenRouter live verification
  still requires account configuration. No program upgrade or database reset.

## Unreleased — Repository organization

- Separate frontend, backend, Solana and shared source.
- Keep Next.js routes as thin adapters and preserve route configuration.
- Group tests, migration history and product documentation.
- Add bilingual README, judging guide and GitHub CI/templates.

## 2026-09-08 — Workspace loading

- Persistent workspace layout and route-specific skeletons.
- Loading, empty and error feedback.
- Wallet refresh retains the last balance; transaction progress stays visible.
- Commit: ff95405.

## 2026-09 — Clarity interface

- Shared light-terminal styles, responsive layout and bilingual copy.
- Manual assessment is presented before optional AI.
- Commit: 38754ed.

## Earlier milestones

- Program-controlled challenge escrow on Solana Devnet: 291a235.
- Wallet profiles and sharing controls: 6f30727.
