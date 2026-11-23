import assert from "node:assert/strict";
import test from "node:test";
import { synchronizePreviewQuality } from "../src/core/preview-quality-transition.js";
import { previewGraphBudget, previewRuntimeProfile } from "../src/core/preview-performance.js";
import { PREVIEW_TRANSITION } from "../src/core/preview-audio.js";
import { previewQualityStatus } from "../src/ui/preview-quality-controls.js";

function fixture() {
  const calls = [];
  const runtime = previewRuntimeProfile({ userAgent: "Android" });
  const player = {
    playing: false, liveVoices: new Map(), previewRuntime: runtime,
    previewBudget: previewGraphBudget(runtime), qualityTransition: null,
    master: { gain: { value: 0.42, cancelAndHoldAtTime: () => calls.push("hold"),
      exponentialRampToValueAtTime: () => calls.push("fade") } },
    context: { state: "running", currentTime: 3, onstatechange: () => {},
      async close() { calls.push("close"); this.state = "closed"; } },
    resetContextReferences(context) { assert.equal(context, this.context); calls.push("reset"); this.context = null; },
  };
  return { player, calls };
}

test("quality changes preserve the fade, close the old graph, and leave notes and position alone", async () => {
  const { player, calls } = fixture();
  player.position = 17;
  player.events = [{ pitch: 60, time: 2, velocity: 1 }];
  const events = structuredClone(player.events);
  const changed = await synchronizePreviewQuality(player, () => "studio", {
    wait: async ms => { assert.equal(ms, Math.ceil((0.04 + PREVIEW_TRANSITION.sourceTailSeconds) * 1000)); calls.push("wait"); },
  });
  assert.equal(changed, true);
  assert.deepEqual(calls, ["hold", "fade", "wait", "close", "reset"]);
  assert.equal(player.previewBudget.reverbChannels, 2);
  assert.equal(player.previewRuntime.maxScheduledVoices, 32);
  assert.equal(player.position, 17);
  assert.deepEqual(player.events, events);
  assert.equal(player.qualityTransition, null);
});

test("an active song or live MIDI note defers the change without touching sound", async () => {
  for (const kind of ["playing", "live"]) {
    const { player, calls } = fixture();
    if (kind === "playing") player.playing = true;
    else player.liveVoices.set(60, {});
    assert.equal(await synchronizePreviewQuality(player, () => "studio"), false);
    assert.deepEqual(calls, []);
    assert.equal(player.previewRuntime.quality, "auto");
  }
});

test("concurrent starts share one transition and the latest preference wins", async () => {
  const { player, calls } = fixture();
  let quality = "studio", finishFade;
  const first = synchronizePreviewQuality(player, () => quality, { wait: () => new Promise(resolve => { finishFade = resolve; }) });
  const second = synchronizePreviewQuality(player, () => quality);
  assert.strictEqual(first, second);
  quality = "auto";
  finishFade();
  await first;
  assert.equal(player.previewRuntime.quality, "auto");
  assert.equal(calls.filter(x => x === "close").length, 1);
});

test("disposal during the fade cannot reset a replacement context", async () => {
  const { player, calls } = fixture();
  let finishFade;
  const transition = synchronizePreviewQuality(player, () => "studio", { wait: () => new Promise(resolve => { finishFade = resolve; }) });
  const replacement = { state: "suspended" };
  player.context = replacement;
  finishFade();
  assert.equal(await transition, false);
  assert.strictEqual(player.context, replacement);
  assert.equal(calls.includes("reset"), false);
  assert.equal(calls.includes("close"), false);
});

test("context close failures stay visible and release transition ownership for retry", async () => {
  const { player } = fixture();
  const handler = player.context.onstatechange;
  player.context.close = async () => { throw new Error("close failed"); };
  await assert.rejects(synchronizePreviewQuality(player, () => "studio", { wait: async () => {} }), /close failed/);
  assert.equal(player.qualityTransition, null);
  assert.equal(player.previewRuntime.quality, "auto");
  assert.strictEqual(player.context.onstatechange, handler);
});

test("sound status distinguishes selected, pending, and active profiles without claiming MIDI audio export", () => {
  assert.match(previewQualityStatus("studio", "auto", true), /Pause, then press Play/);
  assert.match(previewQualityStatus("studio", "auto", false), /Press Play to apply/);
  assert.match(previewQualityStatus("studio", "studio", false), /more battery/);
  assert.match(previewQualityStatus("auto", "auto", false), /Device-friendly/);
});
