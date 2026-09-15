# Competition upgrade runbook

## What to test after Vercel redeploy

The database adds opportunity details, applications and sponsorship journals
automatically. Existing challenge funds and signed submission versions are retained.
No Solana program upgrade is required for these application-layer features.

1. Sign in as business A/reviewer and approve a submission. Manual review works
   without any AI key. If adjusting an AI score, include an explanation.
2. Issue a credential through the existing issuer flow. Both businesses and
   universities with active issuer configurations can now be accepted by opportunities.
3. Sign in as business B, create a draft opportunity and publish it. Set an issuer,
   minimum score, requirements and optional future application deadline.
4. Sign in as the student. Open the opportunity, select a credential and check
   eligibility. Preview the display name, introduction and portfolio URL before
   consenting to submit. No private profile, bank data or submission files are shared.
5. Refresh and submit again: the existing application is returned, not a duplicate.
6. Sign in as business B. Open applications and recheck the credential. Historical
   eligibility is retained separately from the current verification result. Shortlisting
   and hiring decisions remain human decisions.
7. Revoke a dedicated test credential and check again. Fresh verification must fail;
   the old application and historical receipt remain inspectable.

## Submission progress

Open **Submissions → Track progress and claim rewards**. The timeline distinguishes
human approval, reward allocation, actual claim and credential issuance. It refreshes
while visible; errors preserve the last observation and label it stale. On-chain
submission records must match the stored submission ID, wallet and evidence hash.

Claim using sponsored fees, self-paid fees or the independent tool. A signed transaction
must be reconciled before starting a new one. The independent tool continues to work
with a recipient-funded fee even if the sponsorship server is unavailable.

## Sponsored fee configuration

In Vercel, set these server-only values and redeploy:

| Variable | Value |
| --- | --- |
| SPONSORED_CLAIMS_ENABLED | true |
| SOLANA_SPONSOR_SECRET | Dedicated funded Solana Devnet keypair, JSON byte array or base58 |
| SPONSOR_DAILY_LAMPORTS | 100000000 (0.1 SOL) |
| SPONSOR_MAX_CLAIM_LAMPORTS | 3000000 (0.003 SOL) |

The sponsor pays transaction fees and, for USDC, recipient token-account rent when
needed. It never pays the award itself. The server builds the instruction set, journals
the message, validates the recipient signature, rejects modified messages and signs only
that exact prepared message. The signature and signed bytes are saved before broadcasting.

Prepared attempts reserve budget conservatively. Expired/failed attempts still count
against that day's budget; they are not an automatic refund of budget. Each user can
prepare at most three attempts per day. Reusing an unexpired prepared attempt does not
reserve twice. GET status/reconciliation works even when new sponsorship is disabled.

Use a wallet with no SOL to test. With SOL rewards, the balance grows by the award;
with USDC rewards, only the sponsor pays the SOL fee/rent. Review the first signer and
fee in Explorer. The stored live evidence currently covers SOL; do not claim a live
USDC sponsorship run until you perform that test with funded Devnet USDC.

## Evidence-linked AI review

AI extraction/retrieval now preserves file ID and hash, chunk ID and PDF page where
available. **Open evidence** reads the exact authorized file, verifies its hash and
highlights the matched quote in extracted text. PDF opens to the associated page;
exact bounding-box highlighting inside the native PDF viewer is not claimed. DOCX is
shown as extracted text. Scanned/unsupported files require manual inspection.

Older assessments without file bindings remain readable as stored evidence, with an
explicit warning instead of guessing a file with the same name. Viewing a quote does
not call AI. Score adjustments store the original proposal and the official changes.

The owner will perform the final live OpenRouter check manually after this release.
Provider contract, caching/provenance and reviewer paths have automated checks. Set
the OpenRouter variables following the [provider guide](../deployment/openrouter.md).

## Demo sequence

Prepare the challenge, funding and submission before the presentation so deadlines
do not consume demo time. Show: fund proof → evidence inspection → human approval →
progress → claim → credential → application to business B. For negative examples,
use separate test records for revoked credentials, wrong-wallet access and tampered
messages. Clearly label test fixtures and separate them from live Devnet evidence.

The opportunity gate records verifier-authorized historical access receipts; it does
not independently parse SAS credentials inside the current on-chain program. Fresh
SAS checks are performed by the verifier service before recording/applying. The
independent verifier can inspect SAS directly. Describe this trust boundary accurately.
