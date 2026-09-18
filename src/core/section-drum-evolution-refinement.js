import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";
import { normalizeGenreId } from "./genre-contract.js";
import { clampMidiVelocity } from "./note-contract.js";
import { hash32, seededUnit } from "./deterministic-rng.js";
import { cloneValue } from "./clone-value.js";

export const SECTION_DRUM_EVOLUTION_VERSION = 1;
export const MAX_SECTION_DRUM_EDITS = 6;

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
const PAYOFF_SECTIONS = new Set(["chorus", "drop", "theme"]);
const BUILD_SECTIONS = new Set(["prechorus", "build"]);
const VERSE_SECTIONS = new Set(["verse", "idea", "solo"]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, finite(value)));
const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
};


function resolveGenre(song, config) {
  return normalizeGenreId(config?.genre ?? song?.genre ?? song?.meta?.genre);
}

function resolveSeed(song, config) {
  return String(config?.seed ?? song?.seed ?? song?.meta?.seed ?? song?.id ?? "section-drums");
}

function findDrumTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "drums" || track?.type === "drums") ?? null;
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase();
}

function sectionWindow(section, index, sections, song) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = numeric(section?.startBeat)
    ?? (numeric(section?.startBar) ?? numeric(section?.start) ?? 0) * beatsPerBar;
  const explicitEnd = numeric(section?.endBeat);
  const next = sections[index + 1];
  const nextStart = next
    ? numeric(next?.startBeat) ?? (numeric(next?.startBar) ?? numeric(next?.start) ?? 0) * beatsPerBar
    : null;
  const bars = Math.max(0, numeric(section?.bars) ?? 0);
  const end = explicitEnd
    ?? (nextStart != null && nextStart > start ? nextStart : null)
    ?? (bars > 0 ? start + bars * beatsPerBar : start + beatsPerBar * 4);
  return { start: round(start), end: round(Math.max(start, end)), beatsPerBar };
}

function inWindow(note, window) {
  const start = finite(note?.start);
  return start >= window.start - 1e-6 && start < window.end - 1e-6;
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
    velocity: clampMidiVelocity(velocity),
    ...metadata,
  });
  return true;
}

function snareNotes(notes, window) {
  return notes
    .filter((note) => [38, 40].includes(Number(note?.pitch)) && inWindow(note, window))
    .sort((left, right) => finite(left.start) - finite(right.start));
}

function addGhostResponse(notes, window, section, seed, occurrence, evolution) {
  const snares = snareNotes(notes, window);
  if (!snares.length) return null;
  const referenceIndex = hash32(`${seed}|ghost-ref|${section.id}|${occurrence}`) % snares.length;
  const reference = snares[referenceIndex];
  const preferBefore = seededUnit(seed, `ghost-side:${section.id}:${occurrence}`) < 0.62;
  const offsets = preferBefore ? [-0.25, 0.25] : [0.25, -0.25];
  for (const offset of offsets) {
    const start = round(finite(reference.start) + offset);
    if (start <= window.start + 0.05 || start >= window.end - 0.05 || noteAt(notes, 38, start)) continue;
    const velocity = Math.max(30, Math.min(58, finite(reference.velocity, 86) * (0.38 + evolution * 0.12)));
    if (addHit(notes, 38, start, velocity, 0.045, {
      rhythmicFeature: "section-ghost-snare",
      drumEvolutionRole: "ghost-response",
      phraseRole: "response",
      sectionId: section.id ?? null,
      sectionName: sectionName(section),
    })) return { type: "ghost-snare", start };
  }
  return null;
}

function addKickResponse(notes, window, section, seed, occurrence, energy, evolution) {
  const snares = snareNotes(notes, window);
  if (!snares.length) return null;
  const reference = snares[hash32(`${seed}|kick-ref|${section.id}|${occurrence}`) % snares.length];
  const offsets = seededUnit(seed, `kick-offset:${section.id}:${occurrence}`) < 0.72 ? [0.5, 0.75] : [0.75, 0.5];
  for (const offset of offsets) {
    const start = round(finite(reference.start) + offset);
    if (start <= window.start + 0.05 || start >= window.end - 0.05 || noteAt(notes, 36, start)) continue;
    const velocity = 72 + energy * 15 + evolution * 7;
    if (addHit(notes, 36, start, velocity, 0.065, {
      rhythmicFeature: "section-kick-response",
      drumEvolutionRole: "kick-response",
      phraseRole: "response",
      sectionId: section.id ?? null,
      sectionName: sectionName(section),
    })) return { type: "kick-response", start };
  }
  return null;
}

function addTransitionPickup(notes, window, section, energy, evolution) {
  const start = round(window.end - 0.5);
  if (start <= window.start + 0.25 || noteAt(notes, 38, start)) return null;
  const velocity = 52 + energy * 18 + evolution * 8;
  if (!addHit(notes, 38, start, velocity, 0.05, {
    rhythmicFeature: "section-snare-pickup",
    drumEvolutionRole: "transition-pickup",
    phraseRole: "pickup",
    sectionId: section.id ?? null,
    sectionName: sectionName(section),
  })) return null;
  return { type: "transition-pickup", start };
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
  const candidate = cloneValue(song);
  const drumTrack = findDrumTrack(candidate);
  const sections = Array.isArray(candidate?.structure) ? candidate.structure : candidate?.sections;
  if (!drumTrack || !Array.isArray(drumTrack.notes) || !Array.isArray(sections) || sections.length < 3) return null;

  const evolution = Number.isFinite(Number(config?.evolution)) ? clamp(config.evolution) : 0.58;
  if (evolution <= 0.001) return null;
  const energy = Number.isFinite(Number(config?.energy)) ? clamp(config.energy) : genre === "trap" ? 0.78 : 0.68;
  const fills = Number.isFinite(Number(config?.drumFills)) ? clamp(config.drumFills) : genre === "trap" ? 0.72 : 0.42;
  const maxEdits = Math.min(MAX_SECTION_DRUM_EDITS, Math.max(2, Math.round(2 + evolution * 4)));
  const seed = resolveSeed(candidate, config);
  const notes = drumTrack.notes;
  const occurrences = new Map();
  const edits = [];

  for (let index = 0; index < sections.length && edits.length < maxEdits; index += 1) {
    const section = sections[index];
    const name = sectionName(section);
    const occurrence = (occurrences.get(name) ?? 0) + 1;
    occurrences.set(name, occurrence);
    const window = sectionWindow(section, index, sections, candidate);
    if (window.end - window.start < 2) continue;

    if (BUILD_SECTIONS.has(name) && fills > 0.001) {
      const pickup = addTransitionPickup(notes, window, section, energy, evolution);
      if (pickup) edits.push({ ...pickup, sectionId: section.id ?? null, sectionName: name, occurrence });
      continue;
    }

    if (PAYOFF_SECTIONS.has(name)) {
      const response = addKickResponse(notes, window, section, seed, occurrence, energy, evolution);
      if (response) edits.push({ ...response, sectionId: section.id ?? null, sectionName: name, occurrence });
      if (occurrence > 1 && edits.length < maxEdits) {
        const ghost = addGhostResponse(notes, window, section, seed, occurrence, evolution);
        if (ghost) edits.push({ ...ghost, sectionId: section.id ?? null, sectionName: name, occurrence });
      }
      continue;
    }

    if (VERSE_SECTIONS.has(name) && occurrence > 1) {
      const ghost = addGhostResponse(notes, window, section, seed, occurrence, evolution);
      if (ghost) edits.push({ ...ghost, sectionId: section.id ?? null, sectionName: name, occurrence });
    }
  }

  if (!edits.length) return null;
  notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  appendRhythmicFeature(candidate, "Section-aware drum evolution");
  candidate.idea.sectionDrumEvolutionHits = edits.length;
  candidate.idea.sectionDrumEvolutionSections = [...new Set(edits.map((edit) => edit.sectionId).filter(Boolean))].length;
  return { song: candidate, edits, evolution, energy, fills };
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
        sectionDrumEvolution: diagnostics,
      },
    },
  };
}

export function applySectionDrumEvolutionRefinement(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const genre = resolveGenre(song, config);
  const disabled = (reason) => ({
    song,
    diagnostics: Object.freeze({
      version: SECTION_DRUM_EVOLUTION_VERSION,
      attempted: false,
      accepted: false,
      changed: false,
      reason,
      genre,
      candidateLimit: 1,
      candidatesEvaluated: 0,
    }),
  });

  if (config?.sectionDrumEvolution === false) return disabled("disabled");
  if (!ELIGIBLE_GENRES.has(genre)) return disabled("genre-not-eligible");
  if (!song || typeof song !== "object") return disabled("missing-song");
  if (Number.isFinite(Number(config?.evolution)) && Number(config.evolution) <= 0.001) return disabled("evolution-off");

  const candidate = buildCandidate(song, config, genre);
  if (!candidate) return disabled("no-section-opportunity");

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
    version: SECTION_DRUM_EVOLUTION_VERSION,
    attempted: true,
    accepted,
    changed: accepted,
    reason: !releaseGate?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !protectedSafe ? "protected-dimension-regression"
          : scoreDelta < -0.2 || floorDelta < -0.5 ? "critic-regression"
            : "section-drum-win",
    genre,
    candidateLimit: 1,
    candidatesEvaluated: 1,
    edits: candidate.edits.length,
    editTypes: candidate.edits.map((edit) => edit.type),
    sections: candidate.edits.map((edit) => ({
      sectionId: edit.sectionId,
      sectionName: edit.sectionName,
      occurrence: edit.occurrence,
      type: edit.type,
    })),
    evolution: round(candidate.evolution),
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
    sectionDrums: {
      accepted: true,
      edits: diagnostics.edits,
      editTypes: diagnostics.editTypes,
      scoreDelta: diagnostics.scoreDelta,
    },
  };
  candidate.song.meta = acceptedMetadata(candidate.song, after, releaseGate, diagnostics);
  return { song: candidate.song, diagnostics };
}
