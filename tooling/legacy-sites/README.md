# Legacy Sites support

Preserved reference files for the earlier Sites/Vinext deployment:
`vite.config.ts`, `worker.ts`, `sites-vite-plugin.ts`, `chatgpt-auth.ts`.

The current supported deployment is Next.js on Vercel. This optional toolchain
has not been revalidated as a separate hosted deployment during the folder refactor.
The root `.openai/hosting.json` is retained.

If revisiting it, invoke Vite from the repository root with the explicit config
path and verify bindings/output. The packaging helper reads migrations from
`backend/database/migrations/`. Do not remove Cloudflare compatibility types
without first replacing their uses in the active backend.
