/** Read-only A/B comparison utilities for opt-in arrangement support dynamics. */
import { createMidiExportProjection } from "../../src/music-engine.js";

const ACTIVE_LANES = new Set(["chords", "pad"]);
const finite = (v, fallback = NaN) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const round = (n, precision = 4) => Number(n.toFixed(precision));

function onset(note) { return finite(note.start ?? note.startBeat ?? note.beat ?? note.time); }
function duration(note) { return finite(note.duration ?? note.length ?? note.durationBeats); }
function pitch(note) { return finite(note.pitch ?? note.note ?? note.midi); }
function velocity(note) { return finite(note.velocity ?? note.vel); }

function trackById(song) {
  return new Map((song?.tracks ?? []).map(t => [String(t.id), t]));
}

export function inspectArrangementPair(baseline, experiment) {
  const before = trackById(baseline);
  const after = trackById(experiment);
  if ([...before.keys()].join("|") !== [...after.keys()].join("|")) {
    throw Error("A/B track identity or order differs");
  }
  if (JSON.stringify((baseline.structure ?? []).map(s => [s.id, s.startBeat, s.endBeat])) !==
      JSON.stringify((experiment.structure ?? []).map(s => [s.id, s.startBeat, s.endBeat]))) {
    throw Error("A/B section order or timing differs");
  }
  const modified = [];
  let noteCount = 0;
  for (const [id, leftTrack] of before) {
    const rightTrack = after.get(id);
    const left = leftTrack?.notes ?? [];
    const right = rightTrack?.notes ?? [];
    if (left.length !== right.length) throw Error("A/B note count differs on " + id);
    for (let index = 0; index < left.length; index++) {
      noteCount += 1;
      const a = left[index];
      const b = right[index];
      if (onset(a) !== onset(b) || duration(a) !== duration(b) || pitch(a) !== pitch(b)) {
        throw Error("A/B topology, pitch or timing drift on " + id + " at " + index);
      }
      const delta = velocity(b) - velocity(a);
      if (Math.abs(delta) <= 1e-8) continue;
      if (!ACTIVE_LANES.has(id)) throw Error("A/B velocity altered protected lane " + id);
      if (!["verse-support-restraint", "payoff-support-open"].includes(b.arrangementPerformanceRole)) {
        throw Error("A/B changed velocity without approved stage annotation");
      }
      if (Math.abs(delta) > 7.00001) throw Error("A/B velocity outside approved bound");
      modified.push({ trackId: id, noteIndex: index, start: onset(a), delta: round(delta),
        role: b.arrangementPerformanceRole });
    }
  }
  return { noteCount, changedNotes: modified.length, modified };
}

/** Compare actual exported MIDI events, not just pre-export authored velocities. */
export function inspectExportProjectionPair(baseline, experiment) {
  const a = createMidiExportProjection(baseline);
  const b = createMidiExportProjection(experiment);
  const traces = [a, b].map(p => (p.tracks ?? []).map(track => ({
    id: track.id,
    notes: (track.notes ?? []).map(note =>
      [note.channel, note.onTick, note.offTick, note.pitch, note.velocity]),
  })));
  if (traces[0].length !== traces[1].length) throw Error("MIDI track count drift");
  let changed = 0;
  let notes = 0;
  for (let t = 0; t < traces[0].length; t++) {
    const left = traces[0][t], right = traces[1][t];
    if (left.id !== right.id || left.notes.length !== right.notes.length) {
      throw Error("Exported MIDI track or event count drift");
    }
    for (let n = 0; n < left.notes.length; n++) {
      notes++;
      if (left.notes[n].slice(0, 4).join("|") !== right.notes[n].slice(0, 4).join("|")) {
        throw Error("Exported MIDI tick/channel/pitch drift: " + left.id);
      }
      if (left.notes[n][4] !== right.notes[n][4]) {
        if (!ACTIVE_LANES.has(left.id)) throw Error("Export changed protected lane " + left.id);
        changed++;
      }
    }
  }
  return { noteCount: notes, changedVelocities: changed, exportAudiblyDistinctByVelocity: changed > 0 };
}

/** Deterministic assignment is only for hiding labels, never engine RNG. */
export function blindSideFor(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return (hash & 1) ? "A" : "B";
}
