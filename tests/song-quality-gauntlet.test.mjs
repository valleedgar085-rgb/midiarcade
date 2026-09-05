import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";

const KEYS = ["C", "F#", "Bb", "Db", "E", "Ab", "D"];
const SCALES = ["major", "minor", "dorian", "mixolydian", "harmonicMinor", "minorPentatonic", "lydian"];
const BAR_COUNTS = [8, 12, 16, 20, 24];

function fingerprint(song) {
  return song.tracks.map((track) => (
    `${track.id}:${track.notes.map((note) => `${note.pitch}@${note.start.toFixed(3)}:${note.duration.toFixed(3)}`).join("|")}`
  )).join(";");
}

test("release gauntlet holds every genre above musical and export quality floors", { timeout: 120_000 }, () => {
  const genres = Object.keys(engine.GENRE_PROFILES);
  const failures = [];
  const fingerprints = new Set();
  const totals = [];
  let sampleIndex = 0;

  for (const genre of genres) {
    for (let variationIndex = 0; variationIndex < 3; variationIndex += 1) {
      const song = engine.generateNew({
        seed: `release-gauntlet-${genre}-${variationIndex}`,
        genre,
        key: KEYS[sampleIndex % KEYS.length],
        scale: SCALES[sampleIndex % SCALES.length],
        bars: BAR_COUNTS[sampleIndex % BAR_COUNTS.length],
        energy: [0.2, 0.57, 0.92][variationIndex],
        complexity: [0.28, 0.68, 0.88][variationIndex],
        variation: [0.32, 0.72, 0.94][variationIndex],
        swing: [0, 0.18, 0.36][variationIndex],
        humanize: [0.05, 0.22, 0.38][variationIndex],
      });
      const gate = engine.evaluateSongReleaseGate(song);
      const label = `${genre}/${variationIndex}/${song.meta.key}-${song.meta.scale}/${song.meta.bars} bars`;
      if (!gate.passed) failures.push(`${label}: ${gate.failures.join(", ")}`);
      if (!song.meta.scoreDetails?.releaseGate?.passed) failures.push(`${label}: selected song lacks a passing release gate`);
      if (!gate.exportChecks || !Object.values(gate.exportChecks).every(Boolean)) failures.push(`${label}: MIDI export preflight failed`);
      if (!song.finalMaster || !Object.values(song.finalMaster.checks ?? {}).every(Boolean)) failures.push(`${label}: final master contract failed`);
      if (!song.finalAssembly || !Object.values(song.finalAssembly.checks ?? {}).every(Boolean)) failures.push(`${label}: final assembly contract failed`);

      const identity = fingerprint(song);
      if (fingerprints.has(identity)) failures.push(`${label}: duplicated a prior full arrangement`);
      fingerprints.add(identity);
      totals.push(gate.totalScore);

      if (variationIndex === 0) {
        const firstMidi = engine.encodeMidi(song);
        const secondMidi = engine.encodeMidi(song);
        if (!Buffer.from(firstMidi).equals(Buffer.from(secondMidi))) failures.push(`${label}: MIDI bytes are not deterministic`);
        const view = new DataView(firstMidi.buffer, firstMidi.byteOffset, firstMidi.byteLength);
        if (view.getUint16(8) !== 1 || view.getUint16(10) !== 7) failures.push(`${label}: MIDI is not a seven-track type-1 file`);
      }
      sampleIndex += 1;
    }
  }

  assert.equal(fingerprints.size, genres.length * 3, "all gauntlet arrangements should be unique");
  assert.ok(Math.min(...totals) >= 78, `minimum score ${Math.min(...totals)} fell below release floor`);
  assert.ok(totals.reduce((sum, score) => sum + score, 0) / totals.length >= 88, "average release score should remain professional-grade");
  assert.deepEqual(failures, [], `song-quality gauntlet failures:\n${failures.join("\n")}`);
});
