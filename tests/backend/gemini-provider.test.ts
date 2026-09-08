import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_EVIDENCE, makeFixtureAssessment } from "../../shared/validation/assessment-contract.ts";
import { generateLiveAssessment } from "../../backend/ai/assessment-engine.ts";

test("Gemini provider returns a validated structured assessment", async () => {
  const previousFetch = globalThis.fetch;
  const draft = makeFixtureAssessment();
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await generateLiveAssessment(
      { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-test" },
      "test-session",
      { title: "Growth Strategy 90D", brief: "Test brief", rubric: [] },
      DEMO_EVIDENCE,
    );
    assert.equal(result.provenance.provider, "gemini");
    assert.equal(result.provenance.model, "gemini-test");
    assert.equal(result.provenance.validationPassed, true);
    assert.match(requestUrl, /models\/gemini-test:generateContent$/);
    assert.ok(requestHeaders);
    assert.equal(requestHeaders.get("x-goog-api-key"), "test-key");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Gemini provider uses the current latest model when no model is configured", async () => {
  const previousFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = (async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(makeFixtureAssessment()) }] } }] }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await generateLiveAssessment(
      { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" },
      "test-session",
      { title: "Growth Strategy 90D", brief: "Test brief", rubric: [] },
      DEMO_EVIDENCE,
    );
    assert.match(requestUrl, /models\/gemini-flash-latest:generateContent$/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
