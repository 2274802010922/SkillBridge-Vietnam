import test from "node:test";
import assert from "node:assert/strict";
import { locateQuote } from "../../shared/validation/citation-location.ts";
import { retrieveEvidence } from "../../backend/ai/evidence-retrieval.ts";
import { scoreChanges } from "../../shared/validation/review-changes.ts";
import { makeFixtureAssessment } from "../../shared/validation/assessment-contract.ts";
test("citation matching retains original text across whitespace and case", () => {
  const text = "Kế hoạch\n  THỬ NGHIỆM (A+B) có KPI rõ ràng.";
  const hit = locateQuote(text, "thử nghiệm (A+B) có KPI");
  assert.ok(hit);
  assert.equal(text.slice(hit.start, hit.end), hit.text);
  assert.equal(locateQuote(text, "không có bằng chứng"), null);
});
test("retrieval keeps identity and hash for files with identical names", () => {
  const chunks = [
    {
      id: "one",
      file_id: "file-a",
      file_hash: "hash-a",
      locator: "same.pdf · trang 1",
      content: "Market research evidence with budget and customer interviews.",
      ordinal: 0,
      tokenEstimate: 20,
    },
    {
      id: "two",
      file_id: "file-b",
      file_hash: "hash-b",
      locator: "same.pdf · trang 2",
      content: "Experiment metrics and measurable campaign results.",
      ordinal: 0,
      tokenEstimate: 20,
    },
  ];
  const result = retrieveEvidence([], chunks, {
    title: "Market",
    brief: "Experiment",
    rubric: [
      { id: "research", label: "Market research", maxScore: 50 },
      { id: "execution", label: "Experiment metrics", maxScore: 50 },
    ],
  });
  assert.equal(result.evidence.length, 2);
  assert.equal(new Set(result.evidence.map((s) => s.fileId)).size, 2);
  for (const source of result.evidence) {
    assert.ok(source.fileHash);
    assert.ok(source.page);
  }
});
test("review delta records changed scores without mutating the AI proposal", () => {
  const ai = makeFixtureAssessment(),
    final = structuredClone(ai);
  final.rubric[0].score -= 1;
  const changes = scoreChanges(ai, final);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].aiScore - changes[0].officialScore, 1);
});
