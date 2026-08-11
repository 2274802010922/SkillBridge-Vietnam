import assert from "node:assert/strict";
import test from "node:test";
import { address } from "gill";
import { derivePolicyAddress, OPPORTUNITY_GATE_PROGRAM_ADDRESS } from "../lib/opportunity-gate.ts";

const authority = address("5zDXaZk7HWcdzEZRKfTQ8atG8XE6P6CyYT7Gf8xHU4LT");

test("opportunity policy PDA is deterministic", async () => {
  const first = await derivePolicyAddress(authority, "opportunity-001");
  const second = await derivePolicyAddress(authority, "opportunity-001");
  assert.equal(first.policy, second.policy);
  assert.deepEqual(first.policyId, second.policyId);
  assert.equal(first.policyId.length, 32);
});

test("different opportunity ids cannot share the same policy PDA", async () => {
  const first = await derivePolicyAddress(authority, "opportunity-001");
  const second = await derivePolicyAddress(authority, "opportunity-002");
  assert.notEqual(first.policy, second.policy);
});

test("client uses the compiled opportunity gate program id", () => {
  assert.equal(OPPORTUNITY_GATE_PROGRAM_ADDRESS, "AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE");
});
