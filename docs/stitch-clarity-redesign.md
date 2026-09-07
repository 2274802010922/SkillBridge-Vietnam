# Stitch Clarity implementation

Design source: Stitch project `17615822085455013462`, design system
`assets/12658489630741369016` (SkillBridge Light Terminal Clarity).

## Implementation contract

The shared visual layer is `app/clarity.css`, imported after existing page
styles in the root layout. It intentionally reuses the application's real
components, routes, API responses, roles and transaction verification.
Stitch images are design references, not application data.

- Canvas: #F7F6F1; surface: white; text: #091426; links: #2456E6.
- Lime #B7F34D is the primary action accent, never body text.
- Be Vietnam Pro is self-hosted by Next.js; monospace is reserved for metadata.
- Headings use a readable line height, with wrapping for long names and hashes.
- Header contains one role selector, account/assets menu and VI/EN control.
- Sidebar collapses into a navigation menu on narrow screens. Every existing
  destination remains reachable through primary or advanced navigation.
- Manual assessment precedes optional AI. Existing AI results expand in a
  disclosure below the official assessment; approval does not initiate payment.
- Public landing retains product explanations, workflow, evidence and role
  sections. No invented balances, achievements or testimonials were imported.
- Loading and route failures have dedicated states. Review loading failures
  are distinct from an empty queue.
- English changes interface copy; user-authored submissions retain their language.
- Vercel deployment settings and database schema are unchanged.

## Verification

- Production compilation and the existing 88 regression tests passed.
- ESLint passed.
- Browser inspection used a separate local SQLite database and a generated,
  unfunded test wallet. No production records or funds were used.
- Landing and sign-in were checked at 375, 768, 1024 and 1440 pixels: no
  document horizontal overflow; language controls remained visible.
- Authenticated dashboard, challenge wizard and review layouts were inspected
  at mobile/tablet/desktop widths, including long challenge text and role changes.
- Local end-to-end manual review: open submitted fixture, start manual review,
  enter rubric scores and comments, approve, observe persisted 80/100 and
  approved state. No AI generation or reward transfer was invoked.
- This change does not constitute a new live Devnet payout or bank settlement
  test. Existing financial regression coverage was retained.

## Deploy and inspect

Redeploy the pushed main commit on Vercel. No new environment variables are
required. Verify role switching, VI/EN, challenge draft editing, manual review,
account balance refresh and narrow-screen navigation with the existing wallets.

## Loading behavior

- `app/app/layout.tsx` owns the authenticated header and navigation, so route
  transitions replace the content region without rebuilding the workspace frame.
- `app/components/loading-ui.tsx` selects a dashboard, list, detail, review,
  profile or finance skeleton from the destination route.
- Skeletons appear after 200 ms to avoid flashing on fast responses. After five
  seconds they add a small slow-network explanation.
- Skeleton blocks are decorative; one live-region label announces loading.
  Motion is disabled under `prefers-reduced-motion: reduce`.
- Client-fetched lists distinguish loading, empty and failed states. Submission
  detail requests ignore stale responses when the user switches records quickly.
- Wallet refresh retains the last successful balance, shows refresh state and
  records the last update time. Transaction UI exposes signing, broadcast,
  verification and completion states while retaining the existing signature
  recovery path.
