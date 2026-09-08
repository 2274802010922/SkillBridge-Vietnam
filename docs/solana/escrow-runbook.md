# Challenge escrow v1 — Devnet operation

Program: HBasPxF9R83pCFdeuvvXW5Hpt7hSMTXghLRSzeAEGpDB. Classic SPL USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU; SOL uses the default public key as its asset discriminator. The program remains upgradeable. This is a Devnet pilot, not an audited mainnet custody product.

## User flow

1. Create a monetary challenge draft. Open **Quỹ thưởng / Reward funds**.
2. Pick primary and backup reviewers from the reviewing organization; invite a reviewer first if missing. Backup must differ from funder and primary reviewer. Set submission/review deadlines.
3. Save the configuration and inspect terms. Configuration is immutable in this v1; a correction requires a new draft. Deposit initializes and funds the entire budget atomically.
4. Both reviewers accept with their own wallets. Funder publishes with a signature. Terms, asset, budget and deadlines are enforced by the program.
5. Student joins using the existing challenge invitation/public-join flow; uploads files and saves notes. Submit routes to Reward funds for the student signature. A server registrar co-signs admission, ensuring invitation-only enrollment cannot be bypassed. It has no withdrawal authority.
6. Submission v1 is immutable once signing starts. Retry signing the same snapshot after cancellation; files are not uploaded again. This release does not reopen on-chain entries for revisions.
7. Human review remains manual or AI-assisted. After the submission deadline, the designated reviewer signs an eligible/rejected result and explicitly allocates available award slots. A passing grade alone is not an award.
8. Student claims; any direct client can also trigger a claim with its own transaction fee, but the recipient and amount cannot change.
9. Reviewer finalizes only after all admitted entries have a decision and submissions have closed. Funder receives only the unallocated remainder. Reserved awards never expire; they remain claimable after finalization/refund.
10. After the review deadline the backup exclusively takes over review/finalization. If both keys are unavailable, unresolved funds stay locked; no unrestricted rescue withdrawal exists.

## Trust and immutable receipts

- Humans attest eligibility; the program cannot establish the quality or truth of a file.
- Private files/notes remain off-chain. Only opaque IDs and hashes are committed.
- At most one entry per wallet per challenge; this is not proof of a unique person.
- The program enforces fixed identities, classic SPL account ownership/mint/recipient, budget, deadlines, and unique paid receipts. No account-closing instruction is exposed, so receipts cannot be deleted and replayed.
- Rent is separate from reward principal and stays in the accounts in v1. Direct unsolicited deposits are not credited to the reward ledger and are not automatically recoverable; fund through the product's instruction.
- Upgrading the program can change its behavior. Deployment authority is disclosed on Explorer; it has not been revoked.
- Backend synchronization reads finalized accounts and cannot lower the stored snapshot slot. Raw blockchain state is authoritative for transfers.

## Compatibility and environment

Existing challenge_funds rows stay on the legacy path; they are never silently re-labelled or moved. Badge bonds stay legacy in v1. The new program does not use SOLANA_REWARD_VAULT_SECRET. Keep that key for existing funds/cash-out.

The deployed program ID and mint are pinned in the client. Keep SOLANA_RPC_URL on Devnet and SOLANA_AUTHORIZED_SIGNER_SECRET unchanged for the registrar. No new production credentials are required. Database tables are additive and initialized by core schema.

Legacy payouts/refunds persist signed bytes before broadcast and serialize operations per fund. Retry the same request to reconcile finalization; do not rebuild a transfer with a new blockhash on ambiguous results. A preparation failure or expired unresolved transaction requires operator investigation of legacy_vault_operations and Explorer. Never remove a journal entry to force a retry without proving the old transaction cannot settle.

## Build and verification

Use WSL with the repository's Anchor 1.1.2 toolchain:

```sh
cd solana
cargo test -p challenge-escrow --lib
cargo build-sbf --manifest-path programs/challenge_escrow/Cargo.toml
anchor idl build -p challenge_escrow -o target/idl/challenge_escrow.json
```

For transaction tests, start a fresh solana-test-validator with this program and the synthetic mint/token accounts under `tests/fixtures/`. From the repository root, run `npm run test:anchor` (the script is `tests/solana/escrow-program-smoke.ts`). These fixed test keys are for local validator only.

The Devnet proof script requires an explicit ESCROW_PROOF_PAYER_PATH and spends a small amount of Devnet SOL on test-account rent/fees. Never run it with a mainnet funding objective.

## Acceptance cases

Missing consent, post-publication refund, duplicate submission, unresolved finalization, unauthorized reviewer, duplicate allocation, recipient redirection, concurrent claims, and repeated refunds must fail. SOL and USDC positive flows must both pass using the compiled SBF program. Backend errors/reloads must be recoverable from account state without another deposit.
