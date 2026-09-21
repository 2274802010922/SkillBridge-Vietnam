# Demo reliability handoff

Updated: 2026-09-21
Baseline: `0c6c4ff`. Implementation commit: `7cdbe72`.
Publication checkpoint follows that commit; verify origin/main before resuming.
Scope: [active plan](../../plans/active/2026-09-20-demo-reliability.md).

## Checkpoint

- Implemented rewardProgress/operation postconditions, committed score checks,
  backup reviewer messaging, refresh feedback and program payout read model.
- Added API text/JSON normalization, bounded client requests, busy cleanup,
  wallet/session matching and signed-transaction recovery endpoint.
- Added milestone intent/signature journal and bootstrap step journal via additive
  runtime schema + migration 0022. Schema identifiers are unchanged.
- Hardened uploads and Blob completion bytes; MIME fallback for Markdown.
- OpenRouter error classification, deadline budget and invalid-cache handling.
- Extended milestone UI to submit/approve/pay/verify.
- No program/IDL change, no broadcast or production DB change.

## Validation

- Production build (including TypeScript) and **184/184 tests passed** on 2026-09-21.
- Includes 16 additional unit/database/HTTP cases; positive record/allocate/claim
  and repeated sync use matching operation payloads against controlled RPC.
- Browser fixture: refresh reports outcome next to the button; next action visible;
  no horizontal overflow at 375/768/1024/1440, VI/EN guidance checked, no console error.
- Real extension signing, authenticated Vercel, Blob callback and live OpenRouter
  remain owner-run acceptance. No new live transfers were sent.
- Final lint, check:repo and diff check passed; 318 source modules / 59 docs checked.
- Pre-existing untracked `.tmp-video2/` is not part of the release.

## Audit correction

F07's earlier review missed existing ESCROW_TRIGGERS, which already prevent
mutating locked escrow files. Added tests preserve that invariant; additional
conditional writes and byte checks improve other paths. Do not describe F07 as
a demonstrated bypass of those triggers.

## Next step

After publication, redeploy this commit on Vercel, then follow
[acceptance](../../../testing/demo-reliability-acceptance.md).
No new env variable or program upgrade is required. Runtime migration 0022 is
additive. The short demo challenge now needs its backup reviewer; do not deposit
again just to refresh. Keep the active plan open until external acceptance is
recorded. New sessions must not redo the completed implementation.
