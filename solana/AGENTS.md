# Solana working rules

Read [module README](README.md), then only the relevant
[escrow runbook](../docs/solana/escrow-runbook.md) or
[independent verifier guide](../docs/solana/independent-verifier.md).
These instructions also matter to backend/frontend code constructing chain messages.

## Network and compatibility

- The product is Devnet; local-validator tests are separate. Preserve network
  checks (`assertEscrowDevnet` in the client). Never treat test assets as real
  money or switch RPC/mints to mainnet as a configuration-only fix.
- Anchor is pinned in [Anchor.toml](Anchor.toml). Program identity must agree
  between `declare_id!`, that config, the escrow IDL and client/server constants.
  Do not generate/replace program IDs or deployment keys during ordinary edits.
- Rust accounts/instructions and TS codecs are manually coupled. When changing
  layouts, seeds or account order, synchronize [escrow IDL](idl/challenge_escrow.json),
  [escrow client](client/challenge-escrow.ts), server builders and independent
  verifier decoders/filters/tests. IDL regeneration alone does not update TS.
- The gate integration uses [manual codecs](server/opportunity-gate.ts) and
  [verification code](client/opportunity-verification.ts); it has no checked-in
  gate IDL. Do not assume a generated client exists.

## Preserve verified invariants

- Only finalized chain observations justify synchronized fund/claim state;
  transaction signatures alone do not. Keep owner/discriminator/PDA checks.
- Preserve fixed recipients, claim replay protection, reviewer/deadline rules,
  locked submission hashes and separation of allocated awards from refunds.
  Never add timeout refunds or change reviewer fallback implicitly.
- New program funds and legacy shared-vault journals are distinct. Do not move
  their funds, clear recovery journals or rewrite signed snapshots to fix a UI.
- Keep private evidence/PII off-chain. AI proposes; humans authorize decisions.
  Gate receipts trust the authorized verifier, not on-chain SAS parsing.
- Do not bundle signing secrets into browser clients/static verifier output.
  Program upgrade authority exists; do not describe this as audited mainnet custody.

## Validation and deployment boundary

From repo root run `npm run check:repo`, `npm run lint`, `npm test` for integrated
changes; the JS suite is not a Rust/SBF or live-chain validation.
For escrow program changes also run the Rust/SBF commands in the module README
and `npm run test:anchor` with the runbook's local validator/fixtures.
Use the relevant gate tests for gate changes.

Live commands (`test:devnet`, `test:independent:devnet`, `test:sponsored:devnet`,
`test:opportunity:devnet`) require explicit prerequisites and spend test SOL.
Do not deploy/upgrade programs or run funding transactions merely to update docs.
Report unavailable toolchains, RPC or credentials as unrun checks; stored evidence
must not be relabeled as a new run. Keep keypairs and generated `target/` private.
