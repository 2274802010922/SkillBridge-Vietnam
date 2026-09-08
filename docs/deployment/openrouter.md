# OpenRouter on Vercel

Add these **server-only** environment variables to the desired Vercel environments,
then redeploy. Do not use a `NEXT_PUBLIC_` prefix.

| Name | Value |
| --- | --- |
| `AI_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | Your private OpenRouter key |
| `OPENROUTER_MODEL` | The exact model ID you select that supports structured outputs |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `AI_MAX_INPUT_TOKENS` | `6000` |
| `AI_MAX_OUTPUT_TOKENS` | `2200` |
| `AI_DAILY_LIMIT_PER_REVIEWER` | `5` |

No model is silently selected for OpenRouter. A free-tier model must still support
the requested JSON schema and provider policy. Free availability/quota is not
guaranteed. Confirm the model and price in your OpenRouter account before testing.
There is no automatic fallback to a paid model or another AI service.

## Where AI is used

- **Draft challenge:** optional suggestions about ambiguous requirements and missing
  deliverables. The creator edits the draft; AI never changes it automatically.
- **Assessment:** local extraction → rubric retrieval → one generation call.
  The evidence used by AI is stored with the assessment, not written into the
  student's committed submission.
- **Approved feedback:** optional clearer wording from the actual human review.
  It does not change scores, the signed result, eligibility or payment.

Assessment results are cached by submission content, files, rubric, prompt version,
provider and model. Concurrent generation is locked per submission. Changing the
version/model creates a different cache key. Failed requests can be retried manually
and count against the daily allowance; there is no automatic generation retry.
AI assistance has its own 5/day/user allowance and content cache.

Input tokens are locally estimated, not exact provider tokenizer counts. Oversized
assessment input is rejected before generation; output is capped. Actual returned
usage is stored where available. Application quotas are not a monetary spending
cap: configure a provider-side key budget as well.

The request uses strict JSON schema, parameter support required, no provider
fallback, and providers marked as not collecting data. Only selected text is sent;
nevertheless, review privacy/consent requirements before uploading real student work.

## Test after redeploy

1. Submit a small text/PDF file with clear evidence.
2. First verify that **manual assessment works without AI**.
3. On a separate submitted test, click AI assessment once.
4. Confirm OpenRouter provenance and usage, then repeat: expect the cached result.
5. Human reviewer checks citations and sets the official score.
6. A missing key, exhausted quota or unsupported model must show an error, never
   a fabricated assessment. Use manual scoring while the provider is unavailable.

Provider behavior has local mocked tests. A live OpenRouter request was **not**
verified in this release because the local environment had no OpenRouter key.
No existing database or Solana program reset/upgrade is required.

Official reference: [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).
