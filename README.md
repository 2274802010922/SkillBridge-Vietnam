# SkillBridge Vietnam

Proof-of-skill challenge infrastructure connecting Vietnamese students,
universities, and businesses.

The current MVP demonstrates one complete golden path:

1. A student accepts a business challenge.
2. The student submits evidence.
3. AI returns a strict, evidence-linked assessment contract.
4. The challenge's reviewing organization (the business itself or an invited
   independent university/business) approves it.
5. The platform issues a proof-of-skill credential.
6. The credential unlocks an opportunity.
7. Revocation removes access.

The authenticated product includes two intentionally distinct payment paths.
Freelancers can create non-custodial USDC Devnet invoice links: clients pay
directly to the recipient wallet, then the freelancer verifies the signature
for a receipt and CSV reconciliation report. Challenges use a separate Reward
Vault: the business funds the full reward amount (or a refundable SOL badge
bond) on Devnet before the challenge can publish. The challenge creator chooses
internal review or an independent reviewing organization; only active reviewer
members can open the queue, while a human reviewer explicitly approves every
payout. The reviewing organization is shown on the challenge and review
screens, and the Reward Vault signs that Devnet transaction with a Solana
Explorer proof. The USDC-to-VND lab now creates a short-lived test quote,
tokenizes a synthetic beneficiary, builds a reference-bound USDC transfer for
the connected wallet, and verifies the finalized transaction on Solana Devnet.
The on-chain leg is real Devnet activity; the bank/VND leg remains an explicit
sandbox and never claims a real payout.

The reward-receiving workspace now lets a recipient choose between keeping
USDC in the connected wallet, receiving VND to a bank account, or using a
MoMo/ZaloPay destination. These are intentionally separate concerns: a future
licensed off-ramp converts USDC to VND, while a payout provider delivers that
VND. The current Devnet flow tokenizes only a masked test destination, binds
the USDC payment to a Solana reference, verifies finalization, and records an
idempotent sandbox reconciliation. Provider API credentials do not by
themselves enable live money movement.

The `/workspace` route is an isolated role simulator for judges and product
walkthroughs. The authenticated `/app` routes are the production pilot surface:
wallet-based Sign In With Solana binds each user to server-enforced student,
university, or business permissions.

Workflow state is persisted in local SQLite during development and Turso on
Vercel. Evidence files use local private storage during development and a
Private Vercel Blob store after deployment. Credential
issuance and revocation use Solana Attestation Service on Devnet. Opportunity
policies and immutable access receipts use the deployed SkillBridge Opportunity
Gate program at `AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE`.

The production assessment endpoint uses the OpenAI-compatible TokenRouter API
with `qwen/qwen3.8-max-free`. Binary evidence is converted to grounded text on
the server before it reaches the text-only model. AI output must pass the
schema, exact-quote citation, prompt-injection, and human-review gates before a
credential can be issued. The judge sandbox uses a fixture only when no AI key
is configured; a configured provider error is never presented as live AI.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Validation includes assessment contract, evidence-firewall, role authorization,
server rendering, and complete lifecycle cases:

```bash
npm test
```

With the three Devnet signer secrets and a student public address in the
environment, the live on-chain lifecycle can also be checked with:

```bash
npm run test:devnet
```

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```

## Vercel deployment

The application now runs on standard Next.js and is ready for Vercel Preview
deployments. Before testing authenticated roles, connect two storage resources
to the Vercel project:

1. Add the Turso Marketplace integration so Vercel injects
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. Create a Private Blob store so Vercel injects `BLOB_STORE_ID` and uses
   short-lived OIDC authentication. `BLOB_READ_WRITE_TOKEN` remains supported
   for legacy or local workflows.
3. Add `AI_PROVIDER`, the three `TOKENROUTER_*` values, optional Gemini
   `GEMINI_API_KEY`/`GEMINI_MODEL`, and the `SOLANA_*` values from
   `.env.example` to both Preview and Production environments. Set
   `AI_PROVIDER=gemini` to force Gemini, `AI_PROVIDER=tokenrouter` to force
   TokenRouter, or leave `auto` to prefer Gemini when it is configured. For a
   newly created Gemini AI Studio key, use `GEMINI_MODEL=gemini-flash-latest`
   without a `models/` prefix or `:generateContent` suffix. For the Reward
   Vault, configure a separate `SOLANA_REWARD_VAULT_SECRET` keypair and fund
   that Devnet wallet with enough SOL for payout fees. Its public address is
   derived server-side; never expose the secret to the browser.
4. Configure the Devnet off-ramp lab values from `.env.example`. The default
   settlement recipient is the public Reward Vault address; set
   `CASHOUT_DEVNET_SETTLEMENT_WALLET` only when you have a separate public
   Devnet settlement wallet. `CASHOUT_SANDBOX_VND_RATE` is a time-limited test
   quote, not a live FX feed. The wallet-signed USDC transfer and Explorer proof
   are real on Devnet, while the VND bank reconciliation remains a clearly
   labelled sandbox. Do not enable Mainnet or claim real bank payout until a
   licensed off-ramp provider supplies the Vietnam/VND corridor, KYC flow,
   executable quotes and signed webhooks.
5. The cash-out screen retrieves a USDC/USD market reference and a USD/VND
   reference server-side, stores the source snapshots alongside each quote, and
   labels freshness/fallback clearly. `FX_CACHE_TTL_SECONDS=20` is the display
   cache, while `FX_MAX_STALENESS_SECONDS=300` rejects data that is too old
   for a reference quote. `PYTH_HERMES_API_KEY`, `EXCHANGE_RATE_API_KEY`, and
   `OPEN_EXCHANGE_RATES_APP_ID` are optional server-only upgrades; do not put
   them in browser variables. A reference price is not an executable VND rate.
6. The multi-rail receiving UI works immediately with the Devnet sandbox. Keep
   `CASHOUT_MODE=devnet_sandbox`, `REAL_CASHOUT_ENABLED=false` and
   `OFFRAMP_PROVIDER=devnet_sandbox`. `PAYOS_*`, `MOMO_*`, and `ZALOPAY_*`
   variables are server-only preparation for approved payout products; adding
   those keys must not be described as enabling USDC-to-VND conversion. A
   concrete, licensed off-ramp adapter, provider certification, webhook
   verification, reconciliation and a restricted canary are still required
   before any real VND transfer can be switched on.
7. Deploy a Preview, test every wallet role, AI assessment, human approval,
   Devnet issuance/revocation, and opportunity verification, then promote that
   exact deployment to Production.

Never paste secret values into `vercel.json`, source code, screenshots, issue
trackers, or deployment URLs. Vercel environment changes require a redeploy.

The Solana Devnet program and on-chain addresses are independent of the web
host, so they do not need to be redeployed solely because the frontend and API
move to Vercel.
