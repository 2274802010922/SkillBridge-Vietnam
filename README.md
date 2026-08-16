# SkillBridge Vietnam

Proof-of-skill challenge infrastructure connecting Vietnamese students,
universities, and businesses.

The current MVP demonstrates one complete golden path:

1. A student accepts a business challenge.
2. The student submits evidence.
3. AI returns a strict, evidence-linked assessment contract.
4. A human reviewer approves it.
5. The platform issues a proof-of-skill credential.
6. The credential unlocks an opportunity.
7. Revocation removes access.

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
3. Add the three `TOKENROUTER_*` values and the four `SOLANA_*` values from
   `.env.example` to both Preview and Production environments.
4. Deploy a Preview, test every wallet role, AI assessment, human approval,
   Devnet issuance/revocation, and opportunity verification, then promote that
   exact deployment to Production.

Never paste secret values into `vercel.json`, source code, screenshots, issue
trackers, or deployment URLs. Vercel environment changes require a redeploy.

The Solana Devnet program and on-chain addresses are independent of the web
host, so they do not need to be redeployed solely because the frontend and API
move to Vercel.
