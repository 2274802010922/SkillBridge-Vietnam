# Tests

Run commands from the repository root.

| Directory | Scope |
| --- | --- |
| `backend/` | Assessment, cashout, database, profile and workflow contracts |
| `solana/` | Amount parsing, SIWS, escrow, verification and opt-in chain scripts |
| `integration/` | Rendered HTTP pages and isolated local HTTP flows |
| `fixtures/` | Deterministic local-validator account fixtures |
| `tooling/` | Repository context checks using isolated temporary fixtures, not product data |

`npm test` builds Next.js and runs the regression suite. Live Devnet transactions
and validator tests are deliberately separate from CI.

See [commands and prerequisites](../docs/testing/README.md) and
[manual QA](../docs/testing/manual-test-guide.md).
