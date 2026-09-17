# Evidence portfolios: acceptance and operation

## Scope

The release adds purpose-specific portfolios for students/professionals, employer
comparison, grounded career drafts, server-issued feature trials and recoverable
credential issuance. Existing challenge escrow/claim and wallet onboarding remain.
Freelance milestone records are not newly converted into program escrow.

## What is free and what the trial demonstrates

- Core: existing profile, manual review, credentials, verification and allocated claims.
- A server-issued Personal Plus trial lasts 14 days from first feature use: up to
  10 new portfolio packs and 5 successful/reserved AI drafts per UTC day.
- After trial: up to 2 packs and 1 AI draft/day. Existing packs remain readable,
  editable and shareable even when above the new-pack limit.
- Business comparison/new notes have a 14-day organization trial. Historical notes
  remain visible in the existing application detail after expiry.
- These are demo entitlements, not paid subscriptions, invoices or revenue. No price
  or payment processing has been introduced. Users cannot set their own trial expiry.

## Role-by-role manual acceptance

1. Reviewer approves a submission, then explicitly allows its summary to be reused.
   The permission covers the official summary/scores, not raw files/private quotes.
2. Student/professional opens **My profile → Build an evidence portfolio**. Choose
   employment/freelance, enter a target and select at most five sources. Save.
3. Confirm a different signed-in wallet cannot read or update the private pack.
4. Consent to career AI for the saved version. Inspect each quote/source; generated
   text remains a draft. Editing or publishing is never automatic.
5. Repeat the same request: expect a cache hit without another service credit.
   Failed generation releases the service-credit reservation, but attempt-rate
   limits still apply. Provider costs may still occur; use a provider key budget.
6. Manually approve/edit the introduction and save a new version. Earlier shared
   versions do not change. Public output excludes the private target description.
7. Publish a selected saved version, or grant an existing application access for
   30 days. Only that organization may use the private application grant.
8. Employer selects 2–3 applicants in an opportunity. Different/missing rubrics
   are not ranked together. Open shared evidence and append an internal note.
9. Revoke the grant, summary permission or a dedicated test credential. Recheck:
   source access/cache must fail closed; no false active verification on RPC outage.
10. Shortlisting rechecks eligibility; unavailable RPC must not become rejection
    or successful eligibility. Repeated identical status updates create one event.

Public sharing is an explicit owner choice. Previously downloaded/printed copies
cannot be recalled. Free-text introductions/notes are authored by users, not verified
facts. Quotes present in source text do not prove that an AI inference is correct.

## Credential issuance recovery

The existing Issue credential action now reserves capacity and persists a frozen
payload and signed transaction before broadcast. HTTP 202 means pending, not issued.
Retry the same action to reconcile. Inspect status through
`GET /api/credentials/operations/{assessmentId}`; authorized issuers may POST there
to reconcile. Raw payloads/signed bytes never appear in public operation responses.

Finalized chain success followed by DB failure is recoverable. Unknown network
results keep their reservation and original transaction. Safe blockhash expiry may
prepare again on a later explicit retry after absence checks. `failed` and
`needs_review` are operator states, not an invitation to delete journals or send a
replacement blindly. Revoked stored credentials are never revived by a retry.

No new Solana program deployment or database reset is required. Runtime schema adds
the tables; migrations 0019 and 0020 preserve history. No new production secret is
needed beyond existing Solana signer settings and OpenRouter key/model. Career AI
selects OpenRouter explicitly; other existing AI paths keep their provider settings.

## Automated checks and provenance

Run from root: `npm run check:repo`, `npm run lint`, `npm test`.
The default suite includes portfolio permissions/versioning, atomic quotas, issuance
fault/concurrency tests and an isolated HTTP workflow. The AI preload is test-only;
production code never imports it. RPC fixtures do not move live funds.

For optional browser QA, build first, run
`node --experimental-strip-types tests/helpers/preview-evidence.ts`, then
`node tests/helpers/browser-evidence.mjs` with an existing Playwright runtime set by
`PLAYWRIGHT_MODULE_PATH` and Chrome executable via `CHROME_PATH` if needed. Do not add
these as production dependencies. Both helper servers bind to loopback only.
Use `http://localhost:3343/__qa/student` (or employer/reviewer) to enter labeled QA
data. These endpoints exist only in the helper, never in the deployed product.
Stop the helper when finished. Screenshots are local under `.data/evidence-ui/`.

Browser checks cover VI/EN and 375/768/1024/1440px, the mocked AI action and employer
comparison. They do not claim physical wallet/mobile-app signing or accessibility
certification. Live OpenRouter remains the owner's manual check; existing historical
SOL evidence is not a fresh issuance test. Sponsored USDC still needs its separate
funded live acceptance run.

## Two demo narratives, one product

Business: prepare a target-specific pack → review a cited AI draft → employer
compares permitted evidence → shortlist and record a reason → show trial/usage.
Do not present fixture identities, trial activation or Devnet amounts as customers/revenue.

Technical: inspect permissions and source hashes → revoke access → exercise mocked
failure recovery → inspect existing independent claim evidence. Clearly separate
stored live receipts, locally executed fixtures and checks still pending.
