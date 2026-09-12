import fs from "node:fs";

const updates = [
  {
    path: new URL("../tests/music-engine.test.mjs", import.meta.url),
    label: "phase 40 repair reconciliation seed",
    before: `test("phase 40 reconciles repaired tracks with the actual final interlock plan", () => {\n  const input = {\n    seed: "repair-reconcile-1",`,
    after: `test("phase 40 reconciles repaired tracks with the actual final interlock plan", () => {\n  const input = {\n    seed: "repair-reconcile-3",`,
  },
  {
    path: new URL("../tests/phrase-memory-intelligence.test.mjs", import.meta.url),
    label: "phrase memory repair reconciliation seed",
    before: `test("Phrase Memory remains critic-neutral on the repair reconciliation seed", () => {\n  const input = {\n    seed: "repair-reconcile-1",`,
    after: `test("Phrase Memory remains critic-neutral on the repair reconciliation seed", () => {\n  const input = {\n    seed: "repair-reconcile-3",`,
  },
];

let changed = 0;
for (const update of updates) {
  let source = fs.readFileSync(update.path, "utf8");
  const beforeCount = source.split(update.before).length - 1;
  const afterCount = source.split(update.after).length - 1;
  if (beforeCount === 0 && afterCount === 1) continue;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${update.label}: expected exactly one old block and no new block; found old=${beforeCount} new=${afterCount}`);
  }
  source = source.replace(update.before, update.after);
  fs.writeFileSync(update.path, source);
  changed += 1;
}
console.log(`Updated ${changed} repair reconciliation test seed file(s).`);
