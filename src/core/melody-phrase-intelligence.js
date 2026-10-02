import { trackGroovePulses } from "./groove-contract.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, finite(value))); }
function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}
function mod12(value) { return ((Math.round(finite(value)) % 12) + 12) % 12; }
function melodyTrack(song) { return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null; }
function sections(song) { return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []); }
function bounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat)) ? Number(section.startBeat) : finite(section?.startBar, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat)) ? Number(section.endBeat) : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { start, end, beatsPerBar };
}
function notesIn(track, range) {
  return (track?.notes ?? []).filter((note) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
}
function harmonyAt(song, beat) {
  let result = song?.harmony?.[0] ?? null;
  for (const event of song?.harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat);
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + Math.max(0.01, finite(event?.duration, 0.25)) - 1e-6) return event;
  }
  return result;
}
function chordClasses(event) {
  if (Array.isArray(event?.tones) && event.tones.length) return new Set(event.tones.map(mod12));
  if (Number.isFinite(Number(event?.rootPc))) return new Set([mod12(event.rootPc)]);
  return null;
}
function contour(notes) {
  return notes.slice(1).map((note, index) => Math.sign(finite(note.pitch) - finite(notes[index].pitch)));
}
function contourIdentity(notes) {
  const directions = contour(notes);
  const movementRatio = directions.length
    ? directions.filter((direction) => direction !== 0).length / directions.length
    : 0;
  if (notes.length < 4) return clamp(0.45 + movementRatio * 0.2);
  const windows = [];
  for (let i = 0; i <= notes.length - 4; i += 1) windows.push(contour(notes.slice(i, i + 4)).join(","));
  const counts = new Map();
  for (const item of windows) counts.set(item, (counts.get(item) ?? 0) + 1);
  const repeated = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const repeatedRatio = repeated / Math.max(1, windows.length);
  return clamp(0.25 + repeatedRatio * 0.45 + movementRatio * 0.3 - (1 - movementRatio) * 0.25);
}
function contourMovement(notes) {
  if (notes.length < 2) return 0.55;
  const intervals = notes.slice(1).map((note, index) => Math.abs(finite(note.pitch) - finite(notes[index].pitch)));
  const moving = intervals.filter((value) => value >= 1 && value <= 7).length / intervals.length;
  const extreme = intervals.filter((value) => value > 12).length / intervals.length;
  return clamp(moving - extreme * 0.8);
}
function leapDiscipline(notes) {
  if (notes.length < 3) return 0.72;
  const intervals = notes.slice(1).map((note, index) => Math.abs(finite(note.pitch) - finite(notes[index].pitch)));
  const stepwiseRatio = intervals.filter((value) => value <= 5).length / Math.max(1, intervals.length);
  let isolatedSpikes = 0;
  let hugeLeaps = 0;
  for (let index = 1; index < notes.length - 1; index += 1) {
    const previous = finite(notes[index - 1]?.pitch);
    const current = finite(notes[index]?.pitch);
    const next = finite(notes[index + 1]?.pitch);
    const left = Math.abs(current - previous);
    const right = Math.abs(next - current);
    const direct = Math.abs(next - previous);
    if (left >= 7 && right >= 7 && direct <= 5) isolatedSpikes += 1;
    if (left > 12 || right > 12) hugeLeaps += 1;
  }
  const interior = Math.max(1, notes.length - 2);
  return clamp(
    0.46
      + stepwiseRatio * 0.5
      - (isolatedSpikes / interior) * 0.72
      - (hugeLeaps / interior) * 0.5,
  );
}
function groovePurpose(song, notes, range) {
  if (!notes.length) return 0;
  const pulses = trackGroovePulses(song?.grooveConductor, "melody", range.start, range.end, range.beatsPerBar);
  if (!pulses.length) return 0.75;
  const fit = notes.filter((note) => pulses.some((pulse) => Math.abs(pulse - finite(note.start)) <= 0.12)).length / notes.length;
  return clamp(0.35 + fit * 0.65);
}
function harmonicLandings(song, notes) {
  if (!notes.length) return 0;
  const important = notes.filter((note, index) => finite(note.duration, 0.25) >= 0.65 || index === notes.length - 1);
  if (!important.length) return 0.65;
  let contextual = 0, fit = 0;
  for (const note of important) {
    const classes = chordClasses(harmonyAt(song, finite(note.start)));
    if (!classes?.size) continue;
    contextual += 1;
    if (classes.has(mod12(note.pitch))) fit += 1;
  }
  return contextual ? fit / contextual : 0.7;
}
function expressiveShape(notes) {
  if (notes.length < 3) return 0.55;
  const velocities = notes.map((note) => finite(note.velocity, 84));
  const durations = notes.map((note) => finite(note.duration, 0.25));
  const spread = (Math.max(...velocities) - Math.min(...velocities)) / 24;
  const durationKinds = new Set(durations.map((value) => Math.round(value * 4) / 4)).size;
  return clamp(spread * 0.55 + Math.min(1, durationKinds / 3) * 0.45);
}

/**
 * Read-only melody phrase critic. It measures musical intent rather than density.
 * No notes are inserted, deleted, moved, or repitched here.
 */
export function evaluateMelodyPhraseIntelligence(song) {
  const track = melodyTrack(song);
  if (!track) return Object.freeze({ version: 1, passed: false, score: 0, reason: "missing-melody", sections: [] });
  const reports = sections(song).map((section) => {
    const range = bounds(song, section);
    const notes = notesIn(track, range);
    const metrics = {
      motifIdentity: round(contourIdentity(notes)),
      contourMovement: round(contourMovement(notes)),
      leapDiscipline: round(leapDiscipline(notes)),
      groovePurpose: round(groovePurpose(song, notes, range)),
      harmonicLandings: round(harmonicLandings(song, notes)),
      expressiveShape: round(expressiveShape(notes)),
    };
    const score = Math.round(100 * (
      metrics.motifIdentity * 0.21
      + metrics.contourMovement * 0.14
      + metrics.leapDiscipline * 0.1
      + metrics.groovePurpose * 0.21
      + metrics.harmonicLandings * 0.21
      + metrics.expressiveShape * 0.13
    ));
    return Object.freeze({ sectionId: String(section?.id ?? ""), notes: notes.length, score, metrics: Object.freeze(metrics) });
  });
  const active = reports.filter((entry) => entry.notes >= 2);
  const score = Math.round(active.reduce((sum, entry) => sum + entry.score, 0) / Math.max(1, active.length));
  const weakestSection = [...active].sort((a, b) => a.score - b.score)[0] ?? null;
  return Object.freeze({
    version: 1,
    authority: "melody-phrase-intelligence-v1",
    mode: "read-only",
    passed: active.length > 0 && score >= 68,
    score,
    reason: active.length ? (score >= 68 ? "melody-phrase-coherent" : "melody-phrase-weak") : "melody-inactive",
    weakestSection,
    sections: Object.freeze(reports),
  });
}
