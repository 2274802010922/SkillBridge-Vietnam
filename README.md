# SkillBridge Vietnam

Proof-of-skill challenge infrastructure connecting Vietnamese students,
universities, and businesses.

The current MVP demonstrates one complete golden path:

1. A student accepts a business challenge.
2. The student submits evidence.
3. AI drafts an evidence-linked assessment.
4. A human reviewer approves it.
5. The platform issues a proof-of-skill credential.
6. The credential unlocks an opportunity.
7. Revocation removes access.

Workflow state is persisted in Cloudflare D1. The credential issuance screen is
currently an explicit prototype preview while the project waits for devnet test
SOL; the Solana Attestation Service lifecycle has already been validated against
a local validator.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Validation:

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```
