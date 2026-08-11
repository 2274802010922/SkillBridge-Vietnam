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

Workflow state is persisted in Cloudflare D1 and evidence files in R2. Credential
issuance and revocation use Solana Attestation Service on Devnet. Opportunity
policies and immutable access receipts use the deployed SkillBridge Opportunity
Gate program at `AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE`.

The assessment endpoint uses OpenAI Responses API Structured Outputs when the
server has `OPENAI_API_KEY`. Without a key, it uses a clearly labelled,
deterministic fixture so the product flow and contract can still be evaluated
without pretending that a live model ran. Set `OPENAI_ASSESSMENT_MODEL` to
override the default `gpt-5.6-luna` model.

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
