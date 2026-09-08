# Backend

Server code for the same Next.js/Vercel deployment.

| Folder | Responsibility |
| --- | --- |
| `http/` | Request handlers, preserving authorization and response contracts |
| `auth/` | Sessions, organization permissions, nonce and rate limits |
| `ai/` | Providers, document extraction, retrieval and assessment orchestration |
| `services/` | Escrow synchronization, profiles, cashout records and audit logic |
| `database/` | Drizzle schema, runtime schema, migrations and the libSQL adapter |
| `storage/` | Private evidence storage |
| `config/` | Server environment access |
| `types/` | Runtime environment type compatibility |

[app/api/](../app/api/) only exports supported HTTP handlers and preserves Next.js
route configuration such as `runtime` and `maxDuration`.

The existing database uses a D1-compatible adapter on top of libSQL. Cloudflare
type dependencies remain intentional even on Vercel. Do not delete them based
only on their names.

Migration identifiers and SQL order are preserved. Generate from the root with
`npm run db:generate`; do not rename migration history to tidy filenames.
