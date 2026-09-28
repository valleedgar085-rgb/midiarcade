import { applyPerformanceEngine } from "./performance-engine.js";
import { createPerformanceShadowReport } from "./performance-shadow.js";
import { createProfessionalGenerationGauntletSong } from "./professional-gauntlet-song.js";

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function noteCount(song) {
  return (song?.tracks ?? []).reduce(
    (sum, track) => sum + (Array.isArray(track?.notes) ? track.notes.length : 0),
    0,
  );
}

function sourceNote(song, sourceRef) {
  if (
    !sourceRef
    || !Number.isInteger(sourceRef.trackIndex)
    || !Number.isInteger(sourceRef.noteIndex)
  ) return null;
  return song?.tracks?.[sourceRef.trackIndex]?.notes?.[sourceRef.noteIndex] ?? null;
}

function applyPerformedEvent(note, event) {
  const canonical = event?.canonical ?? {};
  const performed = event?.performed ?? {};

  note.canonicalStartBeat = canonical.startBeat;
  note.canonicalDurationBeats = canonical.durationBeats;
  note.canonicalVelocity = canonical.velocity;

  note.start = performed.startBeat;
  note.duration = performed.durationBeats;
  note.pitch = performed.renderedMidiPitch;
  note.velocity = performed.velocity;
  note.articulation = performed.articulation;
  note.microtimingMs = performed.microtimingMs;
  note.performanceAuthority = "performance-engine-v1";
  note.performed = clone(performed);
  return note;
}

export function createPerformanceAuditionSong(song, {
  humanize = 0.65,
  seed = song?.seed ?? song?.id ?? "performance-audition",
} = {}) {
  if (!song || !Array.isArray(song?.tracks)) {
    throw new TypeError("createPerformanceAuditionSong requires a generated song");
  }

  const report = createPerformanceShadowReport(song, { humanize, seed });
  if (!report.safeToAudition) {
    throw new Error("Performance audition blocked by technical shadow safety checks");
  }

  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const performance = applyPerformanceEngine(gauntletSong, { humanize, seed });
  const auditionSong = clone(song);
  const expectedNotes = noteCount(song);
  let mappedNotes = 0;

  for (const event of performance.events) {
    const note = sourceNote(auditionSong, event?.sourceRef);
    if (!note) {
      throw new Error(`Performance audition could not map canonical event ${event?.id ?? "unknown"} back to its source note`);
    }
    applyPerformedEvent(note, event);
    mappedNotes += 1;
  }

  if (mappedNotes !== expectedNotes || noteCount(auditionSong) !== expectedNotes) {
    throw new Error("Performance audition note-count parity failed");
  }

  auditionSong.performanceAudition = {
    version: 1,
    mode: "preview-only",
    sourceSongId: song?.id ?? null,
    engine: performance.id,
    shadow: report.id,
    humanize: performance.humanize,
    seed: String(seed),
    promotionCandidate: report.promotionCandidate,
  };

  return Object.freeze({
    version: 1,
    id: "performance-ab-audition-v1",
    currentSong: song,
    performanceSong: auditionSong,
    report,
    mappedNotes,
    noteCount: expectedNotes,
  });
}
