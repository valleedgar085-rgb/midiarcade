import { cloneValue } from "./clone-value.js";
import { nearestGroovePulse, trackGroovePulses } from "./groove-contract.js";
import {
  evaluateMelodyRhythmPocket,
  refineMelodyRhythmPocket,
} from "./melody-rhythm-pocket.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function track(song, id) {
  return (song?.tracks ?? []).find((entry) => String(entry?.id ?? "") === id) ?? null;
}

function start(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function pitch(note) {
  return Math.round(finite(note?.pitch ?? note?.note ?? note?.midi, 60));
}

function setStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"]
    .find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "start";
  note[key] = round(value);
}

function protectedNote(note) {
  return Boolean(
    note?.phraseAnchor
    || note?.resolutionRole
    || note?.transitionHandoffRole
    || note?.transitionRole
    || note?.memoryRole
    || note?.motifMemoryRole
    || note?.finalAssemblyRole
    || note?.ensembleCadenceRole
    || note?.preserveSubdivision
    || note?.preserveTiming
  );
}

function sectionBounds(song, beat) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  for (const section of song?.structure ?? song?.sections ?? []) {
    const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
    const endBeat = finite(section?.endBeat, startBeat + Math.max(1, finite(section?.bars, 1)) * beatsPerBar);
    if (beat >= startBeat - 1e-6 && beat < endBeat - 1e-6) return { startBeat, endBeat, beatsPerBar };
  }
  return null;
}

function nearestDistance(value, candidates = []) {
  if (!candidates.length) return Infinity;
  return Math.min(...candidates.map((candidate) => Math.abs(value - candidate)));
}

function kickBassMetrics(song) {
  const kicks = (track(song, "drums")?.notes ?? [])
    .filter((note) => [35, 36].includes(pitch(note)))
    .map(start);
  const bass = track(song, "bass")?.notes ?? [];
  if (!bass.length) {
    return {
      compared: 0,
      connected: 1,
      exactLock: 0,
      shortReply: 0,
      offbeat: 0,
      independent: 0,
    };
  }

  let exactLock = 0;
  let shortReply = 0;
  let offbeat = 0;
  let independent = 0;
  for (const note of bass) {
    const beat = start(note);
    const exact = nearestDistance(beat, kicks);
    if (exact <= 0.08 + 1e-9) {
      exactLock += 1;
      continue;
    }
    const replies = kicks
      .map((kick) => beat - kick)
      .filter((distance) => distance >= -0.08 && distance <= 0.75 + 1e-9);
    const forward = replies.length
      ? [...replies].sort((left, right) => Math.abs(left) - Math.abs(right))[0]
      : null;
    if (forward != null && forward >= 0.08 && forward <= 0.34 + 1e-9) shortReply += 1;
    else if (forward != null && forward >= 0.42 && forward <= 0.58 + 1e-9) offbeat += 1;
    else independent += 1;
  }
  const connected = (exactLock + shortReply + offbeat) / bass.length;
  return { compared: bass.length, connected, exactLock, shortReply, offbeat, independent };
}

function laneAlignment(song, trackId, { protectedOnly = false, freeOnly = false } = {}) {
  const notes = (track(song, trackId)?.notes ?? []).filter((note) => (
    (!protectedOnly || protectedNote(note))
    && (!freeOnly || !protectedNote(note))
  ));
  if (!notes.length) return { compared: 0, alignment: 1 };
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  let compared = 0;
  let aligned = 0;
  for (const note of notes) {
    const beat = start(note);
    const bounds = sectionBounds(song, beat);
    if (!bounds) continue;
    const pulses = trackGroovePulses(
      song?.grooveConductor,
      trackId,
      bounds.startBeat,
      bounds.endBeat,
      beatsPerBar,
    );
    if (!pulses.length) continue;
    compared += 1;
    if (nearestDistance(beat, pulses) <= 0.14 + 1e-9) aligned += 1;
  }
  return { compared, alignment: compared ? aligned / compared : 1 };
}

export function evaluateCompositionPocketLock(song) {
  const bass = laneAlignment(song, "bass");
  const melody = laneAlignment(song, "melody", { freeOnly: true });
  const phraseAnchors = laneAlignment(song, "melody", { protectedOnly: true });
  const kickBass = kickBassMetrics(song);
  const melodyPocket = evaluateMelodyRhythmPocket(song);
  const melodySpace = clamp((melodyPocket?.diagnostics?.score ?? 100) / 100);
  const score = Math.round(100 * (
    clamp(bass.alignment) * 0.35
    + clamp(kickBass.connected) * 0.2
    + clamp(melody.alignment) * 0.25
    + melodySpace * 0.2
  ));

  return Object.freeze({
    version: 1,
    authority: "composition-pocket-lock-v1",
    mode: "read-only",
    score,
    checks: Object.freeze({
      bassGrooveAligned: bass.alignment >= 0.7,
      kickBassConnected: kickBass.connected >= 0.55,
      melodyGrooveAligned: melody.alignment >= 0.6,
      phraseAnchorsPreserved: true,
      melodySpaceHealthy: melodyPocket.passed,
    }),
    metrics: Object.freeze({
      bassCompared: bass.compared,
      bassGrooveAlignment: round(bass.alignment),
      kickBassCompared: kickBass.compared,
      kickBassConnection: round(kickBass.connected),
      exactKickBassLocks: kickBass.exactLock,
      shortBassReplies: kickBass.shortReply,
      offbeatBassReplies: kickBass.offbeat,
      independentBassNotes: kickBass.independent,
      melodyCompared: melody.compared,
      melodyGrooveAlignment: round(melody.alignment),
      phraseAnchorCompared: phraseAnchors.compared,
      phraseAnchorAlignment: round(phraseAnchors.alignment),
      melodyCollisionRatio: melodyPocket.diagnostics.collisionRatio,
      melodySpaceScore: melodyPocket.diagnostics.score,
    }),
    melodyPocket,
  });
}

function bassCollision(notes, moving, beat) {
  return notes.some((note) => note !== moving && Math.abs(start(note) - beat) < 0.045);
}

function relockBass(song) {
  const bass = track(song, "bass")?.notes ?? [];
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  let changedNotes = 0;
  let totalShift = 0;

  for (const note of bass) {
    if (protectedNote(note)) continue;
    const original = start(note);
    const bounds = sectionBounds(song, original);
    if (!bounds) continue;
    const nearest = nearestGroovePulse(
      song?.grooveConductor,
      "bassPulses",
      original,
      beatsPerBar,
      0.16,
    );
    if (
      nearest.distance == null
      || nearest.distance < 0.04 - 1e-9
      || nearest.distance > 0.16 + 1e-9
      || nearest.beat < bounds.startBeat - 1e-6
      || nearest.beat >= bounds.endBeat - 1e-6
      || bassCollision(bass, note, nearest.beat)
    ) continue;

    setStart(note, nearest.beat);
    note.compositionPocketRole = "bass-groove-relock";
    note.compositionPocketShiftBeats = round(nearest.beat - original);
    changedNotes += 1;
    totalShift += Math.abs(nearest.beat - original);
  }

  bass.sort((left, right) => start(left) - start(right) || pitch(left) - pitch(right));
  return { changedNotes, totalShift };
}

export function refineCompositionPocketLock(sourceSong) {
  const before = evaluateCompositionPocketLock(sourceSong);
  if (!sourceSong?.tracks?.length) {
    return Object.freeze({
      song: cloneValue(sourceSong),
      accepted: false,
      changedNotes: 0,
      before,
      after: before,
    });
  }

  const bassCandidate = cloneValue(sourceSong);
  const bassRepair = relockBass(bassCandidate);
  const melodyRepair = refineMelodyRhythmPocket(bassCandidate);
  const candidate = melodyRepair.accepted ? melodyRepair.song : bassCandidate;
  const after = evaluateCompositionPocketLock(candidate);
  const changedNotes = bassRepair.changedNotes + (melodyRepair.accepted ? melodyRepair.changedNotes : 0);

  const protectedSafe = after.metrics.phraseAnchorAlignment + 1e-9 >= before.metrics.phraseAnchorAlignment;
  const bassSafe = after.metrics.bassGrooveAlignment + 1e-9 >= before.metrics.bassGrooveAlignment;
  const melodySafe = after.metrics.melodySpaceScore + 1e-9 >= before.metrics.melodySpaceScore;
  const improved = after.score > before.score
    || after.metrics.bassGrooveAlignment > before.metrics.bassGrooveAlignment + 1e-9
    || after.metrics.melodyGrooveAlignment > before.metrics.melodyGrooveAlignment + 1e-9
    || after.metrics.melodySpaceScore > before.metrics.melodySpaceScore + 1e-9;
  const accepted = changedNotes > 0 && improved && protectedSafe && bassSafe && melodySafe;

  if (!accepted) {
    return Object.freeze({
      song: cloneValue(sourceSong),
      accepted: false,
      changedNotes: 0,
      before,
      after: before,
      diagnostics: Object.freeze({
        bassChangedNotes: 0,
        melodyChangedNotes: 0,
        reason: "no-safe-pocket-improvement",
      }),
    });
  }

  candidate.compositionPocketLock = Object.freeze({
    version: 1,
    authority: "groove-dna-shared-pocket",
    changedNotes,
    bassChangedNotes: bassRepair.changedNotes,
    melodyChangedNotes: melodyRepair.accepted ? melodyRepair.changedNotes : 0,
    averageBassShift: bassRepair.changedNotes ? round(bassRepair.totalShift / bassRepair.changedNotes) : 0,
    before: before.metrics,
    after: after.metrics,
  });

  return Object.freeze({
    song: candidate,
    accepted: true,
    changedNotes,
    before,
    after,
    diagnostics: candidate.compositionPocketLock,
  });
}
