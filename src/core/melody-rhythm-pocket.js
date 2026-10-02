import { cloneValue } from "./clone-value.js";

const GENRE_POCKET = Object.freeze({
  hipHop: Object.freeze({ maxShift: 0.25, snareWindow: 0.11, congestionWindow: 0.075, candidates: Object.freeze([0.125, 0.25, -0.125]) }),
  rap: Object.freeze({ maxShift: 0.25, snareWindow: 0.11, congestionWindow: 0.075, candidates: Object.freeze([0.125, 0.25, -0.125]) }),
  trap: Object.freeze({ maxShift: 0.1875, snareWindow: 0.09, congestionWindow: 0.065, candidates: Object.freeze([0.125, -0.125, 0.1875]) }),
  neoSoul: Object.freeze({ maxShift: 0.25, snareWindow: 0.12, congestionWindow: 0.08, candidates: Object.freeze([-0.125, 0.125, 0.25]) }),
  rnbSoul: Object.freeze({ maxShift: 0.25, snareWindow: 0.12, congestionWindow: 0.08, candidates: Object.freeze([-0.125, 0.125, 0.25]) }),
  pop: Object.freeze({ maxShift: 0.125, snareWindow: 0.085, congestionWindow: 0.06, candidates: Object.freeze([-0.125, 0.125]) }),
  house: Object.freeze({ maxShift: 0.0625, snareWindow: 0.055, congestionWindow: 0.045, candidates: Object.freeze([0.0625, -0.0625]) }),
  techno: Object.freeze({ maxShift: 0.0625, snareWindow: 0.05, congestionWindow: 0.04, candidates: Object.freeze([0.0625, -0.0625]) }),
  jazz: Object.freeze({ maxShift: 0.25, snareWindow: 0.08, congestionWindow: 0.06, candidates: Object.freeze([-0.125, 0.125, -0.25, 0.25]) }),
});

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}
function start(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}
function setStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"].find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "start";
  note[key] = round(value);
}
function pitch(note) {
  return Math.round(finite(note?.pitch ?? note?.note ?? note?.midi, 60));
}
function track(song, id) {
  return song?.tracks?.find?.((candidate) => String(candidate?.id) === id) ?? null;
}
function sections(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}
function sectionBounds(section, beatsPerBar = 4) {
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const endBeat = finite(section?.endBeat, startBeat + Math.max(1, finite(section?.bars, 1)) * beatsPerBar);
  return { startBeat, endBeat };
}
function sectionForBeat(song, beat) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  return sections(song).find((section) => {
    const bounds = sectionBounds(section, beatsPerBar);
    return beat >= bounds.startBeat - 1e-6 && beat < bounds.endBeat - 1e-6;
  }) ?? null;
}
function protectedMelodyNote(note) {
  return Boolean(
    note?.phraseAnchor
    || note?.resolutionRole
    || note?.transitionHandoffRole
    || note?.transitionRole
    || note?.memoryRole
    || note?.motifMemoryRole
    || note?.finalAssemblyRole
    || note?.ensembleCadenceRole
    || note?.tonalLicense
    || note?.harmonicColorSource
  );
}
function profile(song) {
  const genre = String(song?.genre ?? song?.meta?.genre ?? "");
  return GENRE_POCKET[genre] ?? Object.freeze({
    maxShift: 0.125,
    snareWindow: 0.08,
    congestionWindow: 0.06,
    candidates: Object.freeze([-0.125, 0.125]),
  });
}
function drumFoundation(song) {
  const drums = track(song, "drums")?.notes ?? [];
  return {
    kicks: drums.filter((note) => [35, 36].includes(pitch(note))),
    snares: drums.filter((note) => [37, 38, 39, 40].includes(pitch(note))),
    bass: track(song, "bass")?.notes ?? [],
  };
}
function nearAny(beat, notes, tolerance) {
  return notes.some((note) => Math.abs(beat - start(note)) <= tolerance);
}
function onsetDiagnostics(song) {
  const melody = track(song, "melody")?.notes ?? [];
  const foundation = drumFoundation(song);
  const p = profile(song);
  let snareCollisions = 0;
  let denseFoundationCollisions = 0;
  let protectedCount = 0;
  for (const note of melody) {
    const beat = start(note);
    if (protectedMelodyNote(note)) protectedCount += 1;
    if (nearAny(beat, foundation.snares, p.snareWindow)) snareCollisions += 1;
    const layers = [
      nearAny(beat, foundation.kicks, p.congestionWindow),
      nearAny(beat, foundation.snares, p.congestionWindow),
      nearAny(beat, foundation.bass, p.congestionWindow),
    ].filter(Boolean).length;
    if (layers >= 2) denseFoundationCollisions += 1;
  }
  const total = Math.max(1, melody.length);
  const collisionRatio = round((snareCollisions + denseFoundationCollisions * 0.7) / total);
  return Object.freeze({
    melodyNotes: melody.length,
    protectedNotes: protectedCount,
    snareCollisions,
    denseFoundationCollisions,
    collisionRatio,
    score: Math.max(0, Math.round(100 - collisionRatio * 100)),
  });
}
export function evaluateMelodyRhythmPocket(song) {
  const diagnostics = onsetDiagnostics(song);
  return Object.freeze({
    version: 1,
    mode: "read-only",
    genre: String(song?.genre ?? song?.meta?.genre ?? ""),
    passed: diagnostics.collisionRatio <= 0.34,
    repairs: 0,
    diagnostics,
  });
}
function melodyCollision(notes, moving, beat) {
  return notes.some((note) => note !== moving && Math.abs(start(note) - beat) < 0.045);
}
function protectedSpace(song, beat) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const bar = Math.floor(beat / beatsPerBar);
  const offset = round(beat - bar * beatsPerBar, 6);
  const spaces = song?.grooveConductor?.bars?.[bar]?.spaces
    ?? song?.grooveConductor?.bars?.[bar]?.protectedSpaces
    ?? [];
  return spaces.some((space) => Math.abs(finite(space) - offset) < 0.02);
}
function shouldRepair(note, foundation, p) {
  if (protectedMelodyNote(note)) return false;
  const beat = start(note);
  const snare = nearAny(beat, foundation.snares, p.snareWindow);
  const layers = [
    nearAny(beat, foundation.kicks, p.congestionWindow),
    nearAny(beat, foundation.snares, p.congestionWindow),
    nearAny(beat, foundation.bass, p.congestionWindow),
  ].filter(Boolean).length;
  return snare || layers >= 2;
}
export function refineMelodyRhythmPocket(sourceSong) {
  const before = evaluateMelodyRhythmPocket(sourceSong);
  if (!sourceSong?.tracks?.length || !before.diagnostics.melodyNotes) {
    return Object.freeze({ song: cloneValue(sourceSong), accepted: false, changedNotes: 0, before, after: before });
  }
  const song = cloneValue(sourceSong);
  const melody = track(song, "melody")?.notes ?? [];
  const foundation = drumFoundation(song);
  const p = profile(song);
  let changedNotes = 0;
  let totalShift = 0;

  for (const note of melody) {
    if (!shouldRepair(note, foundation, p)) continue;
    const original = start(note);
    const section = sectionForBeat(song, original);
    if (!section) continue;
    const bounds = sectionBounds(section, Math.max(1, finite(song?.meta?.beatsPerBar, 4)));
    const candidates = p.candidates
      .map((delta) => ({ delta, beat: round(original + delta) }))
      .filter(({ delta, beat }) => (
        Math.abs(delta) <= p.maxShift + 1e-9
        && beat >= bounds.startBeat - 1e-6
        && beat < bounds.endBeat - 0.02
        && !melodyCollision(melody, note, beat)
        && !nearAny(beat, foundation.snares, p.snareWindow * 0.72)
        && !protectedSpace(song, beat)
      ))
      .map((candidate) => {
        const layers = [
          nearAny(candidate.beat, foundation.kicks, p.congestionWindow),
          nearAny(candidate.beat, foundation.snares, p.congestionWindow),
          nearAny(candidate.beat, foundation.bass, p.congestionWindow),
        ].filter(Boolean).length;
        return { ...candidate, layers };
      })
      .sort((left, right) => left.layers - right.layers || Math.abs(left.delta) - Math.abs(right.delta));

    const best = candidates[0];
    if (!best) continue;
    setStart(note, best.beat);
    note.melodyPocketRole = "rhythm-space-repair";
    note.melodyPocketShiftBeats = round(best.delta);
    note.melodyPocketSectionId = String(section?.id ?? "");
    changedNotes += 1;
    totalShift += Math.abs(best.delta);
  }

  melody.sort((left, right) => start(left) - start(right) || pitch(left) - pitch(right));
  const after = evaluateMelodyRhythmPocket(song);
  const accepted = changedNotes > 0 && after.diagnostics.collisionRatio < before.diagnostics.collisionRatio - 1e-9;
  if (!accepted) {
    return Object.freeze({ song: cloneValue(sourceSong), accepted: false, changedNotes: 0, before, after: before });
  }
  song.melodyRhythmPocket = Object.freeze({
    version: 1,
    authority: "melody-timing-only",
    changedNotes,
    maxShift: p.maxShift,
    averageShift: round(totalShift / changedNotes),
    before: before.diagnostics,
    after: after.diagnostics,
  });
  return Object.freeze({ song, accepted: true, changedNotes, before, after });
}
