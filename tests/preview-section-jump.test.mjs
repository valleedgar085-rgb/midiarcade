import test from "node:test";
import assert from "node:assert/strict";
import { queuedSectionJumpDue } from "../src/core/preview-section-jump.js";

test("queued section jump becomes due at its beat boundary", () => {
  const queuedSection = { triggerBeat: 16 };

  assert.equal(queuedSectionJumpDue(15.999, queuedSection), false);
  assert.equal(queuedSectionJumpDue(16, queuedSection), true);
  assert.equal(queuedSectionJumpDue(16.001, queuedSection), true);
});

test("queued section jump rejects missing or invalid beat positions", () => {
  assert.equal(queuedSectionJumpDue(16, null), false);
  assert.equal(queuedSectionJumpDue(Number.NaN, { triggerBeat: 16 }), false);
  assert.equal(queuedSectionJumpDue(16, { triggerBeat: Number.NaN }), false);
});

test("audio scheduler handles queued jumps before loop-boundary wrapping", async () => {
  const { readFile } = await import("node:fs/promises");
  const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const schedule = appSource.match(/schedule\(\)\s*\{[\s\S]*?\n\s*voicePriority\(event\)/)?.[0] ?? "";
  const queuedJumpCheck = schedule.indexOf("this.applyQueuedSectionJump(");
  const loopBoundaryCheck = schedule.indexOf("this.commitLoopBoundary(");

  assert.notEqual(queuedJumpCheck, -1);
  assert.notEqual(loopBoundaryCheck, -1);
  assert.ok(queuedJumpCheck < loopBoundaryCheck);
});
