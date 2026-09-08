import assert from "node:assert/strict";
import test from "node:test";
import { generateLiveAssessment } from "../../backend/ai/assessment-engine.ts";
import { selectedAi } from "../../backend/ai/provider-selection.ts";
import {
  DEMO_EVIDENCE,
  makeFixtureAssessment,
} from "../../shared/validation/assessment-contract.ts";

test("OpenRouter uses one explicit model, strict output and no automatic fallback", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url, init) => {
    calls++;
    assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test/structured");
    assert.equal(body.provider.allow_fallbacks, false);
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.response_format.type, "json_schema");
    assert.ok(body.max_tokens <= 4096);
    return Response.json({
      model: "test/structured",
      choices: [
        { message: { content: JSON.stringify(makeFixtureAssessment()) } },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });
  }) as typeof fetch;
  try {
    const result = await generateLiveAssessment(
      {
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test",
        OPENROUTER_MODEL: "test/structured",
      },
      "test",
      { title: "Test", brief: "Test", rubric: [] },
      DEMO_EVIDENCE,
    );
    assert.equal(result.provenance.provider, "openrouter");
    assert.equal(result.provenance.validationPassed, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("OpenRouter quota failure is not replaced with a fixture or another provider", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("", { status: 402 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        generateLiveAssessment(
          {
            AI_PROVIDER: "openrouter",
            OPENROUTER_API_KEY: "test",
            OPENROUTER_MODEL: "test/model",
            GEMINI_API_KEY: "other",
          },
          "x",
          { title: "t", brief: "b", rubric: [] },
          DEMO_EVIDENCE,
        ),
      /hạn mức/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("cache identity tracks the selected provider rather than another configured model", () => {
  assert.deepEqual(
    selectedAi({
      AI_PROVIDER: "openrouter",
      OPENROUTER_MODEL: "one/model",
      GEMINI_MODEL: "wrong",
    }),
    { provider: "openrouter", model: "one/model" },
  );
  assert.throws(
    () => selectedAi({ AI_PROVIDER: "openrouter" }),
    /OPENROUTER_MODEL/,
  );
});
