import assert from "node:assert/strict";
import test from "node:test";
import {
  assignBalancedSides, parseRatings, planSession, ratingsTemplate, scoreSession, signTestP,
} from "../scripts/lib/listening-session.mjs";

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

const many = Array.from({ length: 12 }, (_, index) => ({
  kind: "section-contrast", sourceId: `case-${String(index + 1).padStart(2, "0")}`, treatmentSide: "A", meta: { genre: "funk" },
}));

test("balanced assignment puts the experiment on A and B equally, ignoring the generators' choice", () => {
  const sides = assignBalancedSides(many).map((pair) => pair.treatmentSide);
  assert.equal(sides.filter((side) => side === "A").length, 6);
  assert.equal(sides.filter((side) => side === "B").length, 6);
  const odd = assignBalancedSides(many.slice(0, 5)).map((pair) => pair.treatmentSide);
  assert.equal(odd.filter((side) => side === "A").length, 3);
  assert.deepEqual(assignBalancedSides(many), assignBalancedSides([...many].reverse()).sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId)).map((pair) => pair));
});

test("two-listen answers count only when both listens agree; a flip is unstable", () => {
  const plan = planSession(assignBalancedSides(many.slice(0, 4)));
  const [p1, p2, p3, p4] = plan.pairs;
  const other = (side) => (side === "A" ? "B" : "A");
  const csv = [
    "pair,first,second,notes",
    `${p1.pair},${p1.treatmentSide},${p1.treatmentSide},`,
    `${p2.pair},${other(p2.treatmentSide)},${other(p2.treatmentSide)},`,
    `${p3.pair},A,B,flipped`,
    `${p4.pair},A,,`,
  ].join("\n");
  const result = scoreSession(plan, parseRatings(csv));
  assert.equal(result.answered, 3);
  const row = result.byKind[0];
  assert.deepEqual([row.experiment, row.original, row.none, row.unstable], [1, 1, 1, 1]);
  assert.equal(result.rows.find((entry) => entry.pair === p3.pair).chose, "unstable (flipped with order)");
  assert.equal(result.rows.find((entry) => entry.pair === p4.pair).chose, null);
  assert.throws(() => scoreSession(plan, parseRatings(`pair,first,second,notes\n${p1.pair},C,A,`)), /must be A, B or none/);
});

test("answering B on every balanced pair scores as an even split, not a win", () => {
  const plan = planSession(assignBalancedSides(many));
  const csv = ["pair,first,second,notes", ...plan.pairs.map((entry) => `${entry.pair},B,B,`)].join("\n");
  const result = scoreSession(plan, parseRatings(csv));
  assert.equal(result.overall.experiment, 6);
  assert.equal(result.overall.original, 6);
  assert.equal(result.overall.signTestP, 1);
});

test("the sign test is exact", () => {
  assert.equal(signTestP(0, 0), null);
  assert.equal(signTestP(5, 4), 1);
  assert.equal(signTestP(9, 0), 0.0039);
  assert.equal(signTestP(10, 2), 0.0386);
  assert.equal(signTestP(2, 10), 0.0386);
});
