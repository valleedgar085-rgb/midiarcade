import assert from "node:assert/strict";
import test from "node:test";

import { auditSelectedArrangementHandoff } from "../src/core/arrangement-handoff-audit.js";
import { prepareMidiExport } from "../src/core/export-profile.js";
import { acceptShapeCandidate, createShapeCandidate } from "../src/core/shape-director-engine.js";
import { createArrangementCandidates, MAX_ARRANGEMENT_CANDIDATES } from "../src/core/arrangement-candidates.js";
import { encodeMidiVerified, generateNew } from "../src/music-engine.js";

function sourceSong() {
  const note = (id, start, pitch, velocity = 88, duration = 0.5) => ({ id, start, pitch, velocity, duration });
  const structure = [
    { id: "verse", name: "verse", startBar: 0, startBeat: 0, endBeat: 8, bars: 2 },
    { id: "chorus", name: "chorus", startBar: 2, startBeat: 8, endBeat: 16, bars: 2 },
  ];
  return {
    id: "phase3-authority",
    seed: "phase3-authority",
    title: "Phase 3 parity",
    meta: { tempo: 96, key: "A", mode: "minor", bars: 4, beatsPerBar: 4, totalBeats: 16 },
    structure,
    sections: structuredClone(structure),
    tracks: [
      { id: "drums", notes: [note("d1", 0, 36, 100, 0.2), note("d2", 8, 38, 104, 0.2)] },
      { id: "bass", notes: [note("b1", 0, 45, 94), note("b2", 8, 48, 96)] },
      { id: "chords", notes: [note("c1", 0, 57, 78, 2), note("c2", 8, 53, 82, 2)] },
      { id: "melody", notes: [
        note("m1", 0, 69), note("m2", 1, 72), note("m3", 2, 76),
        note("m4", 4, 72), note("m5", 6, 69), note("m6", 8, 76), note("m7", 9, 79),
      ] },
      { id: "counterpoint", notes: [note("cp1", 4, 76, 76)] },
      { id: "pad", notes: [note("p1", 0, 57, 68, 3)] },
    ],
  };
}

function snapshotWithMix(canonicalSong) {
  const snapshot = structuredClone(canonicalSong);
  snapshot.tracks.find((track) => track.id === "chords").settings = {
    volume: 0.74,
    gate: 0.9,
    pan: 0.2,
    solo: false,
    mute: false,
  };
  snapshot.tracks.find((track) => track.id === "melody").program = 81;
  return snapshot;
}

test("Phase 3 preserves a quality-candidate arrangement through Mix and verified full MIDI export", () => {
  const source = generateNew({ genre: "hipHop", bars: 16, seed: "phase3-arrangement", candidateCount: 1 });
  let candidates = [];
  for (let index = 0; index < 16 && !candidates.length; index += 1) {
    candidates = createArrangementCandidates(source, {
      genre: "hipHop", bars: 16, seed: `phase3-story-${index}`, arrangementEvolution: true,
    });
  }
  assert.ok(candidates.length > 0, "test needs a genuinely reordered arrangement");
  assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
  const canonical = candidates[0].song;
  const original = structuredClone(canonical);
  const mix = snapshotWithMix(canonical);
  const prepared = prepareMidiExport(mix, { profile: "full", timing: "performance" });
  const report = auditSelectedArrangementHandoff(canonical, mix, prepared.song);
  const verified = encodeMidiVerified(prepared.song, prepared.options);
  assert.equal(report.passed, true, JSON.stringify(report.issues));
  assert.equal(report.sectionCount, canonical.structure.length);
  assert.equal(report.trackCount, canonical.tracks.length);
  assert.equal(verified.audit.passed, true, JSON.stringify(verified.audit.mismatches));
  assert.deepEqual(canonical, original, "auditioned canonical arrangement must remain immutable during export");
});

test("Phase 3 Shape Accept becomes the only source for both performance and tight MIDI exports", () => {
  const canonical = sourceSong();
  const transaction = createShapeCandidate(canonical, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape", direction: "harder",
  }, { seed: "phase3-shape-accept" });
  assert.equal(transaction.status, "candidate");
  const accepted = acceptShapeCandidate(transaction);
  assert.notDeepEqual(accepted, canonical);
  const baseline = structuredClone(accepted);
  for (const timing of ["performance", "tight"]) {
    const mix = snapshotWithMix(accepted);
    const prepared = prepareMidiExport(mix, { timing });
    const report = auditSelectedArrangementHandoff(accepted, mix, prepared.song);
    assert.equal(report.passed, true, JSON.stringify(report.issues));
    const verified = encodeMidiVerified(prepared.song, prepared.options);
    assert.equal(verified.audit.passed, true, JSON.stringify(verified.audit.mismatches));
    assert.deepEqual(accepted, baseline, "Shape-accepted song must remain authoritative and unmodified");
  }
  const staleParent = snapshotWithMix(canonical);
  const stalePrepared = prepareMidiExport(staleParent);
  const staleReport = auditSelectedArrangementHandoff(accepted, staleParent, stalePrepared.song);
  assert.equal(staleReport.passed, false, "Shape parent is no longer authorized after Accept");
  assert.ok(staleReport.issues.includes("accepted-note-drift"));
});

test("Phase 3 blocks stale arrangement order, section timing and silent note replacement", () => {
  const canonical = sourceSong();
  const preparedGood = prepareMidiExport(snapshotWithMix(canonical));
  const pristine = structuredClone(canonical);
  for (const tamper of [
    (snapshot) => { snapshot.structure.reverse(); },
    (snapshot) => { snapshot.structure[1].startBeat += 1; },
    (snapshot) => { snapshot.tracks.find((track) => track.id === "melody").notes[0].pitch += 1; },
    (snapshot) => { snapshot.meta.tempo += 1; },
    (snapshot) => { snapshot.tracks.reverse(); },
  ]) {
    const mix = snapshotWithMix(canonical);
    tamper(mix);
    const report = auditSelectedArrangementHandoff(canonical, mix, preparedGood.song);
    assert.equal(report.passed, false);
    assert.ok(report.issues.length > 0);
  }
  assert.deepEqual(canonical, pristine, "pre-export validation is read-only");
});

test("Phase 3 permits clone-only export articulation while rejecting drift after preparation", () => {
  const canonical = sourceSong();
  const mix = snapshotWithMix(canonical);
  const prepared = prepareMidiExport(mix, { timing: "tight" });
  prepared.song.tracks[2].notes[0].duration = 0.1; // only a prepared clone may change
  assert.equal(auditSelectedArrangementHandoff(canonical, mix, prepared.song).passed, true);
  prepared.song.structure[0].bars = 999;
  const report = auditSelectedArrangementHandoff(canonical, mix, prepared.song);
  assert.equal(report.passed, false);
  assert.ok(report.issues.includes("arrangement-section-drift"));
  assert.notEqual(prepared.song.structure[0].bars, canonical.structure[0].bars);
});
