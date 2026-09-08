<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SkillBridge repository map

- `app/` contains Next.js route/layout adapters. Keep existing URLs stable.
- `frontend/` contains UI, shared components, i18n and styles.
- `backend/` contains HTTP handlers, auth, AI, services, database and storage.
- `solana/` contains Anchor programs, IDL and chain integrations.
- `shared/` contains pure validation/data; no server runtime dependencies.
- `tooling/` preserves optional legacy tools and archived agent instructions.

Current interface guidance: `docs/design/system.md`.
Deployment: Next.js on Vercel from the repository root.
Do not use archived K95/motion skills as the active product design.

After moving files, run `npm run check:repo`, `npm run lint` and `npm test`.
Never rename migration identifiers or expose server code through frontend runtime imports.
