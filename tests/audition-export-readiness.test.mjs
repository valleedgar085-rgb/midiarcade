import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const exportFunction = app.slice(app.indexOf("async function exportSong()"), app.indexOf("function controllerPoints("));

for (const side of ["before", "after", "section-variation"]) {
  test(`Export refuses an undecided ${side} audition without restoring, saving, or sharing anything`, async () => {
    const before = { id: "original" };
    const after = { id: "preview" };
    const state = { song: side === "after" ? after : before,
      shapeDirector: side === "section-variation" ? {} : { transaction: { before, after }, audition: side },
      sectionVariations: side === "section-variation" ? { sectionId: "verse" } : null };
    const messages = [];
    let restored = 0, snapshots = 0;
    const exportSong = runInNewContext(`(${exportFunction})`, {
      state, lastMidiExportStatus: { status: "not-attempted" }, showToast: (message) => messages.push(message),
      resolvePendingShapeDirectorCandidate: () => { restored += 1; state.song = before; },
      buildExportSongSnapshot: () => { snapshots += 1; throw new Error("Must not begin an export"); },
      console: { error() {} },
    });
    const originalSong = state.song;
    await exportSong();
    assert.equal(restored, 0, "must not silently discard the audition");
    assert.equal(snapshots, 0, "must not export an unchosen song");
    assert.equal(state.song, originalSong);
    assert.match(messages.join(" "), /accept|use this change|keep original|finish.*preview/i);
  });
}

test("a failed export cannot reuse a previous successful parity receipt", async () => {
  const context = { state: { song: { id: "next-song" } },
    lastMidiExportStatus: { status: "share-completed", parityPassed: true, songId: "previous-song" },
    buildExportSongSnapshot() { throw new Error("Snapshot failed"); }, showToast() {}, console: { error() {} } };
  await runInNewContext(`(${exportFunction})`, context)();
  assert.equal(context.lastMidiExportStatus.status, "failed");
  assert.equal(context.lastMidiExportStatus.parityPassed, undefined);
  assert.equal(context.lastMidiExportStatus.songId, undefined);
});
