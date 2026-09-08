# Contributing

## Local setup

Use Node.js 22.13+ and `npm ci`. Copy `.env.example` to `.env.local` and use
a separate local database for test records. See [deployment](docs/deployment/vercel.md).

## Change workflow

1. Create a focused branch from `main`.
2. Put changes in the correct layer: [architecture](docs/architecture/README.md).
3. Preserve API URLs, permission checks and financial idempotency.
4. Update both interface languages and relevant documentation.
5. Run `npm run check:repo`, `npm run lint` and `npm test`.
6. Explain the user-visible change and checks in the pull request.

Keep generated builds, local databases, credentials and personal editor files out
of commits. Preserve migration names and journal history.

Live blockchain scripts are opt-in. Ordinary CI must not move funds or require
private keys. No open-source license is granted by this contribution guide.
