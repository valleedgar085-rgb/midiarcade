import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";

export const SOUND_CATCHER_REFINEMENT_VERSION = 1;
export const MAX_SOUND_CATCHER_NOTES = 5;

const ELIGIBLE_GENRES = new Set(["hipHop", "rap", "trap"]);
const PROTECTED_DIMENSIONS = Object.freeze([
  "groove",
  "performance",
  "repetition",
  "phraseResolution",
  "density",
  "memory",
  "motif",
  "separation",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function cloneSong(song) {
  if (typeof structuredClone === "function") return structuredClone(song);
  return JSON.parse(JSON.stringify(song));
}

function noteStart(note) {
  return finite(note?.start ?? note?.time ?? note?.tick);
}

function noteDuration(note) {
  return Math.max(0.01, finite(note?.duration ?? note?.length, 0.25));
}

function setNoteStart(note, start) {
  if (Object.prototype.hasOwnProperty.call(note, "start")) note.start = start;
  else if (Object.prototype.hasOwnProperty.call(note, "time")) note.time = start;
  else note.tick = start;
}

function trackId(track) {
  return String(track?.id ?? track?.name ?? track?.role ?? "").toLowerCase();
}

function genreOf(song, config) {
  return config?.genre ?? config?.style ?? song?.meta?.genre ?? song?.genre;
}

function totalBeatsOf(song) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  return tracks.flatMap((track) => Array.isArray(track?.notes) ? track.notes : [])
    .reduce((max, note) => Math.max(max, noteStart(note) + noteDuration(note)), 0);
}

function phraseWindows(song, config) {
  const beatsPerBar = Math.max(1, finite(config?.beatsPerBar ?? song?.meta?.beatsPerBar, 4));
  const phraseBars = Math.max(2, Math.min(4, Math.round(finite(config?.soundCatcherPhraseBars, 2))));
  const length = beatsPerBar * phraseBars;
  const total = Math.max(length, totalBeatsOf(song));
  const windows = [];
  for (let start = 0; start < total; start += length) {
    windows.push({ start, end: Math.min(total, start + length) });
  }
  return windows;
}

function targetOffsets(count, length) {
  const normalized = count <= 3
    ? [0, 1.5, 3.5]
    : count === 4
      ? [0, 1.5, 3.5, 4.5]
      : [0, 1.5, 3.5, 4.5, 7.5];
  const scale = length >= 8 ? 1 : length / 8;
  return normalized.slice(0, count).map((value) => value * scale);
}

function choosePhraseNotes(notes, window) {
  return notes
    .filter((note) => {
      const start = noteStart(note);
      return start >= window.start && start < window.end;
    })
    .sort((left, right) => noteStart(left) - noteStart(right))
    .slice(0, MAX_SOUND_CATCHER_NOTES);
}

function refinePhrase(notes, window, maxShift) {
  if (notes.length < 3) return 0;
  const targets = targetOffsets(notes.length, window.end - window.start);
  let changed = 0;
  let previous = window.start;
  notes.forEach((note, index) => {
    const original = noteStart(note);
    const target = window.start + targets[index];
    const bounded = Math.max(
      previous + 0.08,
      Math.min(window.end - noteDuration(note) - 0.08, target),
    );
    const next = Math.abs(bounded - original) <= maxShift ? bounded : original;
    if (Math.abs(next - original) > 1e-6) {
      setNoteStart(note, round(next));
      changed += 1;
    }
    previous = Math.max(previous, next);
  });
  return changed;
}

function protectedDelta(before, after, key) {
  return finite(after?.subscores?.[key]) - finite(before?.subscores?.[key]);
}

function buildCandidate(song, config) {
  if (config?.soundCatcherRefinement !== true) return null;
  if (config?.rollAmount !== undefined && finite(config.rollAmount) <= 0) return null;
  if (config?.drumFills !== undefined && finite(config.drumFills) <= 0) return null;
  if (!ELIGIBLE_GENRES.has(String(genreOf(song, config)))) return null;

  const melody = (song?.tracks ?? []).find((track) => {
    const id = trackId(track);
    return id === "melody" || id.includes("lead") || id.includes("hook");
  });
  if (!melody?.notes?.length) return null;

  const candidate = cloneSong(song);
  const candidateMelody = candidate.tracks.find((track) => track === melody)
    ?? candidate.tracks.find((track) => trackId(track) === trackId(melody));
  const maxShift = Math.min(0.18, Math.max(0, finite(config?.soundCatcherMaxShift, 0.14)));
  let changedNotes = 0;
  let changedPhrases = 0;

  phraseWindows(candidate, config).forEach((window) => {
    const notes = choosePhraseNotes(candidateMelody.notes ?? [], window);
    const changed = refinePhrase(notes, window, maxShift);
    if (changed) {
      changedPhrases += 1;
      changedNotes += changed;
    }
  });

  if (!changedNotes) return null;
  candidate.outputQualityEvolution = {
    ...(candidate.outputQualityEvolution ?? {}),
    soundCatcher: {
      version: SOUND_CATCHER_REFINEMENT_VERSION,
      label: "Bounce pocket melody timing",
      changedNotes,
      changedPhrases,
      maxShift,
    },
  };
  return { song: candidate, changedNotes, changedPhrases, maxShift };
}

export function applySoundCatcherRefinement(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const disabled = Object.freeze({
    attempted: false,
    accepted: false,
    changed: false,
    reason: "disabled",
    candidatesEvaluated: 0,
    candidateLimit: 1,
  });
  if (config?.soundCatcherRefinement !== true) return { song, diagnostics: disabled };

  const candidate = buildCandidate(song, config);
  if (!candidate) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-safe-catcher-opportunity",
        candidatesEvaluated: 0,
        candidateLimit: 1,
      }),
    };
  }

  const before = evaluateCandidate(song);
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorBefore = Math.min(...Object.values(before?.subscores ?? {}).map(finite));
  const floorAfter = Math.min(...Object.values(after?.subscores ?? {}).map(finite));
  const floorDelta = floorAfter - floorBefore;
  const protectedDeltas = Object.fromEntries(
    PROTECTED_DIMENSIONS.map((key) => [key, round(protectedDelta(before, after, key), 3)]),
  );
  const protectedSafe = Object.values(protectedDeltas).every((delta) => delta >= -0.75);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && protectedSafe
    && scoreDelta >= -0.2
    && floorDelta >= -0.5
  );
  const diagnostics = Object.freeze({
    attempted: true,
    accepted,
    changed: true,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !protectedSafe ? "protected-regression"
          : accepted ? "catcher-win" : "critic-regression",
    candidatesEvaluated: 1,
    candidateLimit: 1,
    changedNotes: candidate.changedNotes,
    changedPhrases: candidate.changedPhrases,
    maxShift: round(candidate.maxShift),
    beforeScore: round(before?.score, 2),
    afterScore: round(after?.score, 2),
    scoreDelta: round(scoreDelta, 2),
    floorDelta: round(floorDelta, 2),
    protectedDeltas,
  });

  if (!accepted) return { song, diagnostics };

  candidate.song.meta = {
    ...(candidate.song.meta ?? {}),
    ideaFingerprint: createSongFingerprint(candidate.song),
    scoreDetails: {
      ...(candidate.song.meta?.scoreDetails ?? {}),
      releaseGate: release,
      outputQualityPostprocess: {
        ...(candidate.song.meta?.scoreDetails?.outputQualityPostprocess ?? {}),
        soundCatcher: diagnostics,
      },
    },
  };
  return { song: candidate.song, diagnostics };
}
