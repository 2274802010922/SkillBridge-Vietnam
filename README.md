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

The `/workspace` route expands that path into a shared end-to-end role
simulator. Business, Student, and University each receive only the actions
authorized for their role while reading and updating the same D1-backed
challenge journey. The role switcher is intentionally labelled as test
infrastructure; production identity-to-role binding remains a later hardening
step.

Workflow state is persisted in Cloudflare D1. The credential issuance screen is
currently an explicit prototype preview while the project waits for devnet test
SOL; the Solana Attestation Service lifecycle has already been validated against
a local validator.

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

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```
