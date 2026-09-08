# Deploy on Vercel

Import the repository as one **Next.js** project. Keep the Vercel Root Directory
at the repository root, not `frontend/` or `backend/`.

- Install: `npm ci`
- Build: `npm run build` (the existing `vercel-build` script is also retained)
- Runtime: Node.js compatible with the package engine (22.13+)
- Output: Next.js default

## Environment

Use [.env.example](../../.env.example) as the source of configuration names.
Add values in Vercel Environment Variables and redeploy.

| Feature | Configuration group |
| --- | --- |
| Database | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| Private files | `BLOB_STORE_ID`; client uploads also require `BLOB_READ_WRITE_TOKEN` |
| Optional AI | `AI_PROVIDER`, Gemini/TokenRouter credentials and model settings |
| Solana Devnet | `SOLANA_RPC_URL`, mint and server signer configuration |
| Legacy funds / cashout | Dedicated reward-vault and cashout settings |
| FX references | Optional data-provider credentials and freshness limits |

These values are server-only. Do not prefix signing keys or provider secrets with
`NEXT_PUBLIC_`. Local `.env.local` is ignored by Git.

The folder refactor requires no new environment variables, database reset or
program deployment.

## Verify after deployment

1. Confirm the deployment uses the intended Git commit.
2. Open the landing page and sign in with a test wallet.
3. Verify role navigation, profile load and challenge list.
4. Try manual assessment on a test submission.
5. For financial flows follow the [escrow runbook](../solana/escrow-runbook.md).
6. Check errors and logs before repeating an uncertain transaction.
