# Verification commands

All npm commands run from the repository root.

```bash
npm ci
npm run check:repo
npm run lint
npm test
```

The default suite includes a production build and regression tests for server
rendering, authorization, assessments, profiles, payments and escrow contracts.

For context/checker-only changes, run the focused negative/positive fixtures with
`node --test tests/tooling/repo-harness.test.mjs`, plus `npm run check:repo` and
`npm run lint`. These fixtures also run in `npm test`. The checker validates local
link targets, required context files and plan locations/statuses; it does not
prove documentation freshness or validate external URLs/Markdown anchor fragments.

## Explicit chain tests

- `npm run test:devnet`: issuer-to-access lifecycle on Devnet; requires configured
  signer secrets and `DEVNET_STUDENT_ADDRESS`.
- `npm run test:anchor`: escrow local-validator smoke test. Start the validator and
  deploy the program first; see the [escrow runbook](../solana/escrow-runbook.md).
- `tests/solana/escrow-devnet-proof.ts`: explicit Devnet proof generation requiring
  `ESCROW_PROOF_PAYER_PATH`; records real Devnet account rent/fees.

## Local HTTP checks

Wallet onboarding: [browser checks and physical-device acceptance](wallet-onboarding.md).

`tests/integration/wallet-profile-http.mjs` and `escrow-http.mjs` target
isolated local servers. Read their environment options before running.
Use a separate local database; these scripts create test records.

## What CI does not claim

Passing CI is not a new live AI request, Devnet transfer, Rust build or real bank
payout. Those checks have separate prerequisites and evidence.
