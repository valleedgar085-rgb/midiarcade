import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";

export const SNARE_BOUNCE_REFINEMENT_VERSION = 1;
export const MAX_SNARE_BOUNCE_FIGURES = 3;

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

const GENRE_DEFAULTS = Object.freeze({
  hipHop: Object.freeze({ roll: 0.34, fills: 0.42, energy: 0.68, complexity: 0.64 }),
  rap: Object.freeze({ roll: 0.3, fills: 0.38, energy: 0.7, complexity: 0.62 }),
  trap: Object.freeze({ roll: 0.68, fills: 0.72, energy: 0.78, complexity: 0.72 }),
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, finite(value)));
const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
};

function cloneSong(song) {
  if (typeof structuredClone === "function") return structuredClone(song);
  return JSON.parse(JSON.stringify(song));
}

function hash32(text) {
  let hash = 2166136261;
  const source = String(text ?? "snare-bounce");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed, salt) {
  let state = hash32(`${seed}|${salt}`) || 0x9e3779b9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

function resolveGenre(song, config) {
  return String(config?.genre ?? song?.genre ?? song?.meta?.genre ?? "");
}

function resolveSeed(song, config) {
  return String(config?.seed ?? song?.seed ?? song?.meta?.seed ?? song?.id ?? "snare-bounce");
}

function resolveBars(song, config, drumNotes) {
  for (const value of [config?.bars, song?.bars, song?.meta?.bars, song?.settings?.bars]) {
    const bars = Math.round(finite(value));
    if (bars > 0) return bars;
  }
  const structureBars = Array.isArray(song?.structure)
    ? song.structure.reduce((sum, section) => sum + Math.max(0, finite(section?.bars)), 0)
    : 0;
  if (structureBars > 0) return Math.round(structureBars);
  const endBeat = drumNotes.reduce((max, note) => Math.max(max, finite(note?.start) + finite(note?.duration)), 0);
  return Math.max(1, Math.ceil(endBeat / 4));
}

function findDrumTrack(song) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  return tracks.find((track) => track?.id === "drums" || track?.type === "drums") ?? null;
}

function noteAt(notes, pitch, start, tolerance = 1e-5) {
  return notes.some((note) => Number(note?.pitch) === pitch && Math.abs(finite(note?.start) - start) <= tolerance);
}

function addHit(notes, pitch, start, velocity, duration, metadata) {
  if (!(start >= 0) || noteAt(notes, pitch, start)) return false;
  notes.push({
    pitch,
    start: round(start),
    duration: round(duration),
    velocity: Math.max(1, Math.min(120, Math.round(velocity))),
    ...metadata,
  });
  return true;
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function protectedDeltas(before, after) {
  return Object.fromEntries(PROTECTED_DIMENSIONS.map((dimension) => [
    dimension,
    finite(after?.subscores?.[dimension]) - finite(before?.subscores?.[dimension]),
  ]));
}

function appendRhythmicFeature(song, feature) {
  const idea = song.idea ?? (song.idea = {});
  const features = Array.isArray(idea.rhythmicFeatures) ? [...idea.rhythmicFeatures] : [];
  if (!features.includes(feature)) features.push(feature);
  idea.rhythmicFeatures = features;
}

function buildCandidate(song, config, genre) {
  const candidate = cloneSong(song);
  const drumTrack = findDrumTrack(candidate);
  if (!drumTrack || !Array.isArray(drumTrack.notes)) return null;

  const notes = drumTrack.notes;
  const bars = resolveBars(candidate, config, notes);
  if (bars < 8) return null;

  const defaults = GENRE_DEFAULTS[genre] ?? GENRE_DEFAULTS.rap;
  const roll = clamp(config?.rollAmount, 0, 1) || defaults.roll;
  const fills = clamp(config?.drumFills, 0, 1) || defaults.fills;
  const energy = clamp(config?.energy, 0, 1) || defaults.energy;
  const complexity = clamp(config?.complexity, 0, 1) || defaults.complexity;
  const intent = clamp(roll * 0.46 + fills * 0.22 + energy * 0.17 + complexity * 0.15);
  if (intent < 0.28) return null;

  const seed = resolveSeed(candidate, config);
  const phraseBars = Math.max(4, Math.round(finite(config?.producerBrain?.blueprint?.phraseBars, 4)));
  const boundaries = [];
  for (let bar = phraseBars; bar < bars; bar += phraseBars) boundaries.push(bar);
  if (!boundaries.length) return null;

  const maxFigures = Math.min(
    MAX_SNARE_BOUNCE_FIGURES,
    bars >= 24 ? 3 : bars >= 12 ? 2 : 1,
  );
  let figures = 0;
  let addedNotes = 0;
  let lowerVoiceHits = 0;
  let rollHits = 0;

  for (const boundaryBar of boundaries) {
    if (figures >= maxFigures) break;
    const gate = randomUnit(seed, `gate:${boundaryBar}`);
    const threshold = clamp(0.12 + intent * 0.52, 0, 0.72);
    const forceFirst = figures === 0 && intent >= 0.7 && boundaryBar === boundaries[0];
    if (!forceFirst && gate >= threshold) continue;

    const boundaryBeat = boundaryBar * 4;
    const shape = randomUnit(seed, `shape:${boundaryBar}`);
    const baseVelocity = 70 + Math.round(energy * 19 + complexity * 7);
    let figureNotes = 0;

    if (shape < 0.34) {
      if (addHit(notes, 40, boundaryBeat - 0.5, baseVelocity, 0.08, {
        rhythmicFeature: "bounce-snare",
        snareVoice: "lower",
        phraseRole: "pickup",
      })) {
        figureNotes += 1;
        lowerVoiceHits += 1;
      }
    } else if (shape < 0.72) {
      const placements = [
        { offset: 0.75, pitch: 40, gain: 0.72, feature: "bounce-snare" },
        { offset: 0.5, pitch: 38, gain: 0.88, feature: "bounce-snare-roll" },
      ];
      for (const placement of placements) {
        if (addHit(notes, placement.pitch, boundaryBeat - placement.offset, baseVelocity * placement.gain, 0.07, {
          rhythmicFeature: placement.feature,
          snareVoice: placement.pitch === 40 ? "lower" : "main",
          phraseRole: "pickup",
        })) {
          figureNotes += 1;
          if (placement.pitch === 40) lowerVoiceHits += 1;
          else rollHits += 1;
        }
      }
    } else {
      const step = randomUnit(seed, `subdivision:${boundaryBar}`) < 0.55 ? 1 / 6 : 1 / 8;
      const count = step === 1 / 6 ? 3 : 4;
      const start = boundaryBeat - step * count;
      for (let index = 0; index < count; index += 1) {
        const pitch = index === 0 || index === count - 1 ? 40 : 38;
        const gain = 0.58 + (index / Math.max(1, count - 1)) * 0.3;
        if (addHit(notes, pitch, start + index * step, baseVelocity * gain, Math.min(0.065, step * 0.55), {
          rhythmicFeature: index === 0 ? "bounce-snare" : "bounce-snare-roll",
          snareVoice: pitch === 40 ? "lower" : "main",
          phraseRole: "pickup",
          subdivision: round(step),
        })) {
          figureNotes += 1;
          if (pitch === 40) lowerVoiceHits += 1;
          else rollHits += 1;
        }
      }
    }

    if (figureNotes > 0) {
      figures += 1;
      addedNotes += figureNotes;
    }
  }

  if (!addedNotes) return null;
  notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  appendRhythmicFeature(candidate, "Bounce snare pickups");
  candidate.idea.snareBounceFigures = figures;
  candidate.idea.snareBounceHits = addedNotes;
  return { song: candidate, figures, addedNotes, lowerVoiceHits, rollHits, intent };
}

function acceptedMetadata(song, evaluation, releaseGate, diagnostics) {
  const scoreDetails = song?.meta?.scoreDetails ?? {};
  return {
    ...(song.meta ?? {}),
    ideaFingerprint: createSongFingerprint(song),
    scoreDetails: {
      ...scoreDetails,
      totalScore: round(evaluation?.score, 2),
      subscores: { ...(evaluation?.subscores ?? {}) },
      releaseGate,
      outputQualityPostprocess: {
        ...(scoreDetails.outputQualityPostprocess ?? {}),
        snareBounce: diagnostics,
      },
    },
  };
}

export function applySnareBounceRefinement(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const genre = resolveGenre(song, config);
  const disabled = (reason) => ({
    song,
    diagnostics: Object.freeze({
      version: SNARE_BOUNCE_REFINEMENT_VERSION,
      attempted: false,
      accepted: false,
      changed: false,
      reason,
      genre,
      candidateLimit: 1,
      candidatesEvaluated: 0,
    }),
  });

  if (config?.snareBounceRefinement === false) return disabled("disabled");
  if (!ELIGIBLE_GENRES.has(genre)) return disabled("genre-not-eligible");
  if (!song || typeof song !== "object") return disabled("missing-song");

  const candidate = buildCandidate(song, config, genre);
  if (!candidate) return disabled("no-bounce-opportunity");

  const before = evaluateCandidate(song);
  const after = evaluateCandidate(candidate.song);
  const releaseGate = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - creativeFloor(before);
  const deltas = protectedDeltas(before, after);
  const protectedSafe = Object.values(deltas).every((delta) => delta >= -0.75);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 1) >= 0.999999;
  const accepted = Boolean(
    releaseGate?.passed
    && scaleSafe
    && scoreDelta >= -0.2
    && floorDelta >= -0.5
    && protectedSafe
  );

  const diagnostics = Object.freeze({
    version: SNARE_BOUNCE_REFINEMENT_VERSION,
    attempted: true,
    accepted,
    changed: accepted,
    reason: !releaseGate?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !protectedSafe ? "protected-dimension-regression"
          : scoreDelta < -0.2 || floorDelta < -0.5 ? "critic-regression"
            : "bounce-win",
    genre,
    candidateLimit: 1,
    candidatesEvaluated: 1,
    figures: candidate.figures,
    addedNotes: candidate.addedNotes,
    lowerVoiceHits: candidate.lowerVoiceHits,
    rollHits: candidate.rollHits,
    intent: round(candidate.intent),
    beforeScore: round(before?.score, 2),
    afterScore: round(after?.score, 2),
    scoreDelta: round(scoreDelta, 2),
    floorDelta: round(floorDelta, 2),
    protectedDeltas: Object.fromEntries(
      Object.entries(deltas).map(([dimension, delta]) => [dimension, round(delta, 2)]),
    ),
  });

  if (!accepted) return { song, diagnostics };

  candidate.song.outputQualityEvolution = {
    ...(candidate.song.outputQualityEvolution ?? {}),
    snareBounce: {
      accepted: true,
      figures: diagnostics.figures,
      addedNotes: diagnostics.addedNotes,
      lowerVoiceHits: diagnostics.lowerVoiceHits,
      rollHits: diagnostics.rollHits,
      scoreDelta: diagnostics.scoreDelta,
    },
  };
  candidate.song.meta = acceptedMetadata(candidate.song, after, releaseGate, diagnostics);
  return { song: candidate.song, diagnostics };
}
