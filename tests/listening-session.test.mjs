import assert from "node:assert/strict";
import test from "node:test";
import { parseRatings, planSession, ratingsTemplate, scoreSession } from "../scripts/lib/listening-session.mjs";

const pairs = [
  { kind: "section-contrast", sourceId: "case-01", treatmentSide: "A", meta: { genre: "hipHop" } },
  { kind: "section-contrast", sourceId: "case-02", treatmentSide: "B", meta: { genre: "funk" } },
  { kind: "hook-rescue", sourceId: "hook-01", treatmentSide: "B", meta: { genre: "rap" } },
  { kind: "bass-answer", sourceId: "bass-p3-01", treatmentSide: "A", meta: { genre: "neoSoul" } },
];

test("the session order is deterministic and numbers every pair once", () => {
  const first = planSession(pairs);
  const second = planSession([...pairs].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first.pairs.map((entry) => entry.pair), ["pair-01", "pair-02", "pair-03", "pair-04"]);
});

test("the listener-facing template never carries the answer", () => {
  const csv = ratingsTemplate(planSession(pairs));
  assert.match(csv, /^pair,preference,notes\n/);
  assert.ok(!/section|hook|bass|treatment|experiment/i.test(csv));
});

test("scoring maps A/B answers through the key and reports blanks as unanswered", () => {
  const plan = planSession(pairs);
  const side = (id) => plan.pairs.find((entry) => entry.sourceId === id);
  const other = (letter) => (letter === "A" ? "B" : "A");
  const ratings = [
    { pair: side("case-01").pair, preference: side("case-01").treatmentSide },
    { pair: side("case-02").pair, preference: other(side("case-02").treatmentSide) },
    { pair: side("hook-01").pair, preference: "none" },
    { pair: side("bass-p3-01").pair, preference: "" },
  ];
  const result = scoreSession(plan, ratings);
  assert.equal(result.answered, 3);
  assert.equal(result.complete, false);
  const section = result.byKind.find((row) => row.kind === "section-contrast");
  assert.deepEqual([section.experiment, section.original, section.none], [1, 1, 0]);
  assert.equal(result.byKind.find((row) => row.kind === "hook-rescue").none, 1);
  assert.equal(result.byKind.find((row) => row.kind === "bass-answer").answered, 0);
});

test("lowercase answers parse, and bad input throws instead of being skipped", () => {
  const plan = planSession(pairs);
  const csv = `pair,preference,notes\n${plan.pairs[0].pair},a,"punchy, clean"\n${plan.pairs[1].pair},NONE,\n`;
  const ratings = parseRatings(csv);
  assert.equal(ratings[0].notes, '"punchy, clean"');
  assert.equal(scoreSession(plan, ratings).answered, 2);
  assert.throws(() => scoreSession(plan, [{ pair: "pair-99", preference: "A" }]), /unknown pair/);
  assert.throws(() => scoreSession(plan, [{ pair: plan.pairs[0].pair, preference: "C" }]), /must be A, B or none/);
  assert.throws(() => scoreSession(plan, [
    { pair: plan.pairs[0].pair, preference: "A" }, { pair: plan.pairs[0].pair, preference: "B" },
  ]), /rated twice/);
  assert.throws(() => parseRatings("wrong,header\n"), /must start with/);
  assert.throws(() => planSession([{ kind: "x", sourceId: "1", treatmentSide: "C" }]), /treatmentSide/);
  assert.throws(() => planSession([pairs[0], pairs[0]]), /duplicate/);
});
