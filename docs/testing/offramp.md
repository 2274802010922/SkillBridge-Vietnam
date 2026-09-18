# Off-ramp validation and deployment

Scope: Devnet USDC, simulated VND only. No production provider certification,
bank ownership verification, real KYC, automatic refunds or real VND disbursement.
See [architecture](../architecture/offramp.md) for trust boundaries.

## Vercel setup (compatibility changes)

1. Set `CASHOUT_DEVNET_SETTLEMENT_WALLET` to your **dedicated public Devnet wallet**,
   separate from reward escrow. Never use a secret here. Missing setup blocks new
   quotes; existing orders keep their saved destination and mint.
2. Keep `CASHOUT_MODE=devnet_sandbox`, `OFFRAMP_PROVIDER=devnet_sandbox`,
   `REAL_CASHOUT_ENABLED=false`; leave `OFFRAMP_API_BASE_URL` / `OFFRAMP_API_KEY` empty.
3. Keep the configured Solana RPC on Devnet. `SOLANA_USDC_MINT` affects new quotes
   only. Old quotes use their stored mint. Redeploy after environment edits.
4. Back up the database before deployment. Additive runtime initialization creates
   the 0021 journals; never reset DB, rename migrations or remove pending signatures.
5. Optional `CASHOUT_WEBHOOK_SECRET` enables **sandbox v2 callbacks**, not real payout.
   No new partner credentials are needed for the sandbox.

## Automated checks

```sh
node --experimental-strip-types --test tests/backend/offramp.test.ts tests/backend/cashout.test.ts tests/solana/payments.test.ts
npm run check:repo
npm run lint
npx tsc --noEmit
npm test
```

`npm test` builds Next.js and includes `tests/integration/offramp-flow.test.ts`:
isolated temporary SQLite, authenticated HTTP, unsigned wallet-message inspection,
mock finalized RPC, sandbox reconciliation, replay and tenant isolation. The test
preload intercepts only its local fixture RPC and FX services; production has no
fake-provider switch. Tests never broadcast or call a banking provider.

## Manual owner acceptance after deploy

1. Check VI/EN on phone and desktop. Quote, signing and result must say Devnet/test.
2. Select a test bank/MoMo/ZaloPay destination; create a quote. Verify amount, fees,
   recipient, token and both deadlines. KYC is not required **for sandbox**, not verified.
3. Accept before expiry; send once with a Devnet-compatible wallet. Save signature.
   Reopen/reload the page and recheck it; never deposit again to resolve a UI error.
4. Finalized deposit moves to test reconciliation. Recheck twice: one result/reference,
   no duplicated payout/audit. Explorer proves the Devnet deposit, not a VND payment.
5. For an expired quote already paid, use the manual signature field on that same
   order. Late/partial/excess deposits must show “cần đối soát”, retain proof, hide
   new-send controls and avoid automatic payout/refund.
6. Change new-order configuration on a **test** deployment. Existing order details
   must not reroute. If old mint/network metadata is missing, stop for operator review.
7. Physical wallets and live Devnet transfers are separate manual checks; local mocks
   are not evidence those checks ran.

## Sandbox webhook v2

Send POST `/api/webhooks/offramp` with headers:

- `X-Skillbridge-Event-Id`: unique 8–160 character identifier.
- `X-Skillbridge-Timestamp`: current Unix seconds; accepted skew is five minutes.
- `X-Skillbridge-Signature`: `v2=` + hex HMAC-SHA256(secret,
  `timestamp + "." + eventId + "." + exactRawBody`).

JSON fields: `provider:"skillbridge_devnet_offramp"`, `mode:"devnet_sandbox"`,
`orderId`, `providerOrderId:"sandbox:<orderId>"`, `amountVnd` (string matching stored
net amount), `currency:"VND"`, `status:"completed"|"failed"` and, for completion,
`bankReference:"VND-SANDBOX-<reference>"`. No actual account or personal data.

Legacy `sha256=` body-only signatures are rejected. Retry the **same ID and body**
with a fresh timestamp/signature; changed body under the same ID returns conflict.
HTTP 202 means durably received but pending reconciliation, not payout success.
HTTP 200/processed means applied or a harmless terminal-state replay. An early event
can be resumed through an authenticated owner recheck after funding. Quarantined
events never drive payout; inspect the error and issue a corrected new event only
after diagnosing the mismatch. Never edit/delete finalized evidence to force success.
