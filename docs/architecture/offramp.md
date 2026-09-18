# Off-ramp: recoverable sandbox, not a live bank integration

HTTP authentication → orchestration → pinned provider adapter. FX references and
finalized Solana verification remain separate dependencies. Only `SandboxProvider`
is implemented; no Circle, payOS, MoMo or ZaloPay disbursement API is called.
Receiving-method names are simulated destinations, not partner certifications.

## Contract and custody

- New quotes require `CASHOUT_DEVNET_SETTLEMENT_WALLET`, a dedicated public address.
  No reward-vault fallback. This remains a transfer to an operator-controlled
  sandbox wallet, **not** a non-custodial off-ramp. The app does not need its secret.
- Snapshot in `cashout_sessions.metadata_json.offramp` freezes user, beneficiary
  token, wallet, provider/version/mode, mint, recipient, reference, amount, fees,
  test quote and deadlines. `offrampHash` detects accidental snapshot alteration;
  it is not a cryptographic defense against an administrator rewriting the DB.
- Existing orders resolve the stored provider, not today's default. Legacy orders
  recover from stored network/mint/address/reference. Missing metadata requires
  operator reconciliation; the app never guesses a new destination or mint.
- Unsupported configuration (including production flags or provider API keys)
  disables **new** orders. Previously pinned sandbox orders remain recoverable.
- Quote must be accepted before quote expiry. Accepted v2 quotes have a separate
  funding deadline, ten minutes after quote expiry. A stale Solana Pay link can
  still move tokens: late deposits are recorded for reconciliation, not discarded.
- Integer USDC atomic units and whole-VND flooring define the **test** calculation.
  Live FX is a reference, not a bank/provider promise; fallback is explicitly labelled.

## Recovery and state

`quote_ready → awaiting_wallet_signature → onchain_pending → bank_processing → sandbox_completed`

The old API names remain for compatibility. Crypto (`payment_tx`/verification)
and payout (`payout_status`) are separate. Missing finality/RPC retains the submitted
signature. Positive partial, excess, late or unknown-time deposits become
`reconciliation_required`, retaining the transaction and observed amount in the
event journal. Payout failure becomes `payout_failed`, never `onchain_failed`.
Neither exceptional state automatically retries a payout or refunds funds.

The browser reconstructs the permitted unsigned token-transfer message from the
accepted snapshot before opening the wallet. The server verifies RPC Devnet genesis
before building, and checks finalized chain evidence before recording received funds.
Reload recovery uses both the database signature and a wallet-scoped browser journal.
Local storage contains only public signature/order data, never signed bytes or keys.

## Journals

- `offramp_operations`: durable create intent, immutable payload hash, stable
  idempotency key, attempts and expiring fenced lease. An ambiguous failure keeps
  the same key; SandboxProvider returns the same deterministic order. A real
  provider must document equivalent idempotency/lookup before registry admission.
- `offramp_inbox`: unique provider/mode/verified event identity, payload hash,
  whitelisted normalized event, attempts, retry hint and fenced lease. Raw bank
  payloads are not stored. Conflicting payloads are rejected. Early events remain
  retryable; invalid order/amount/provider bindings are quarantined.
- `offramp_signature_claims`: unique order and transaction, avoiding races between
  independent Vercel invocations. Existing legacy signature columns also participate
  in the reservation check. A confirmed deposit cannot be reassigned.
- Payout transition, cashout event, audit and inbox acknowledgement use one libSQL
  write transaction. Terminal outcomes do not regress from delayed callbacks.
  A failed payout is not silently overwritten by a subsequent success simulation.
- Recheck is an authenticated owner action (`PATCH ... {action:"refresh"}`). It
  resumes at most 20 eligible inbox entries (under 20 attempts), then queries the
  pinned adapter. No timer after HTTP response and no implicit cron. Retry timestamps
  are scheduling hints; explicit owner rechecks may retry sooner. Exhausted or
  quarantined events require operator inspection, not deletion of recovery records.

## Migration and extension

Additive [0021](../../backend/database/migrations/0021_offramp_journals.sql) adds
three journals; runtime initialization and Drizzle definitions match. No funds or
old quotes are rewritten. The repository's manually maintained migrations after
0012 are not represented as generated Drizzle snapshots; do not pretend generating
one snapshot for this release reconciles that older toolchain history.

Production requires an implemented adapter with documented Solana/mint/VND corridor,
provider account permissions, executable quote and funding instructions, real KYC /
beneficiary tokens, official webhook scheme, idempotency lookup, reconciliation /
return/refund policies, access controls and operational/legal review. Environment
variables alone cannot enable it. Optional KYC/refund methods are intentionally
absent where capabilities say unsupported; there is no successful fake KYC/refund.

[Validation and deployment guide](../testing/offramp.md)
