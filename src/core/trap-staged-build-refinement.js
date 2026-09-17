import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";

export const TRAP_STAGED_BUILD_VERSION = 1;
export const MAX_TRAP_STAGED_VELOCITY_EDITS = 48;

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

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, finite(value)));
const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
};

function cloneSong(song) {
  return typeof structuredClone === "function"
    ? structuredClone(song)
    : JSON.parse(JSON.stringify(song));
}

function hash32(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
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

function sectionName(section) {
  return String(section?.name ?? section?.type ?? "verse").toLowerCase();
}

function sectionWindow(section, index, sections, song) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = finite(section?.startBeat, finite(section?.startBar, finite(section?.start, 0)) * beatsPerBar);
  const next = sections[index + 1];
  const nextStart = next
    ? finite(next?.startBeat, finite(next?.startBar, finite(next?.start, 0)) * beatsPerBar)
    : null;
  const end = finite(section?.endBeat, nextStart != null && nextStart > start
    ? nextStart
    : start + Math.max(1, finite(section?.bars, 4)) * beatsPerBar);
  return { start, end: Math.max(start, end) };
}

function sectionActivity(name, energy, evolution, complexity) {
  const role = {
    intro: 0.22,
    verse: 0.48,
    idea: 0.48,
    prechorus: 0.68,
    build: 0.72,
    chorus: 0.92,
    drop: 0.96,
    theme: 0.88,
    bridge: 0.5,
    breakdown: 0.3,
    outro: 0.26,
  }[name] ?? 0.48;
  return clamp(role * (0.7 + energy * 0.28) + evolution * 0.08 + complexity * 0.04, 0.08, 1);
}

function drumRole(pitch) {
  const value = Number(pitch);
  if ([35, 36].includes(value)) return "kick";
  if ([37, 38, 40].includes(value)) return "snare";
  if ([42, 44, 46, 49].includes(value)) return "hat";
  return "perc";
}

function keepProbability(role, activity, isAnchor) {
  if (isAnchor) return 1;
  const base = {
    kick: 0.46,
    snare: 0.36,
    hat: 0.3,
    perc: 0.18,
  }[role] ?? 0.2;
  return clamp(base + activity * (role === "kick" ? 0.48 : role === "snare" ? 0.58 : role === "hat" ? 0.62 : 0.52), 0.08, 1);
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function computeProtectedDeltas(before, after) {
  return Object.fromEntries(PROTECTED_DIMENSIONS.map((key) => [
    key,
    finite(after?.subscores?.[key]) - finite(before?.subscores?.[key]),
  ]));
}

function buildCandidate(song, config) {
  if (config?.trapStagedBuild !== true) return null;
  if (String(config?.genre ?? song?.genre ?? song?.meta?.genre ?? "") !== "trap") return null;
  if (Number.isFinite(Number(config?.evolution)) && finite(config.evolution) <= 0.001) return null;

  const drumTrack = (song?.tracks ?? []).find((track) => track?.id === "drums" || track?.type === "drums");
  const sections = Array.isArray(song?.structure) ? song.structure : song?.sections;
  if (!drumTrack?.notes?.length || !Array.isArray(sections) || sections.length < 2) return null;

  const candidate = cloneSong(song);
  const target = candidate.tracks.find((track) => track?.id === drumTrack.id)
    ?? candidate.tracks.find((track) => track?.type === "drums");
  if (!target?.notes?.length) return null;

  const seed = String(config?.seed ?? song?.seed ?? song?.meta?.seed ?? "trap-staged-build");
  const energy = Number.isFinite(Number(config?.energy)) ? clamp(config.energy) : 0.68;
  const evolution = Number.isFinite(Number(config?.evolution)) ? clamp(config.evolution) : 0.58;
  const complexity = Number.isFinite(Number(config?.complexity)) ? clamp(config.complexity) : 0.62;
  const edits = [];
  const sectionEdits = [];

  sections.forEach((section, sectionIndex) => {
    const window = sectionWindow(section, sectionIndex, sections, candidate);
    const activity = sectionActivity(sectionName(section), energy, evolution, complexity);
    target.notes
      .filter((note) => {
        const start = finite(note?.start);
        return start >= window.start - 1e-6 && start < window.end - 1e-6;
      })
      .forEach((note, noteIndex) => {
        if (edits.length >= MAX_TRAP_STAGED_VELOCITY_EDITS) return;
        const role = drumRole(note?.pitch);
        const start = finite(note?.start);
        const isAnchor = Math.abs(start - window.start) <= 1e-4 && role === "kick";
        const keep = randomUnit(seed, `${section?.id ?? sectionIndex}|${noteIndex}|${role}`) <= keepProbability(role, activity, isAnchor);
        if (keep) return;
        const original = Math.max(1, Math.round(finite(note?.velocity, 80)));
        if (original <= 1) return;
        note.velocity = 1;
        note.stagedBuildMuted = true;
        note.stagedBuildRole = role;
        sectionEdits.push({ sectionId: section?.id ?? null, role });
        edits.push({
          sectionId: section?.id ?? null,
          role,
          start: round(start),
          from: original,
          to: 1,
        });
      });
  });

  if (!edits.length) return null;
  candidate.outputQualityEvolution = {
    ...(candidate.outputQualityEvolution ?? {}),
    trapStagedBuild: {
      version: TRAP_STAGED_BUILD_VERSION,
      label: "Sparse-to-full Trap drum build",
      edits: edits.length,
      sectionEdits: sectionEdits.length,
      energy: round(energy),
      evolution: round(evolution),
      complexity: round(complexity),
    },
  };
  candidate.idea = {
    ...(candidate.idea ?? {}),
    trapStagedBuildEdits: edits.length,
  };
  return { song: candidate, edits, energy, evolution, complexity };
}

export function applyTrapStagedBuildRefinement(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const genre = String(config?.genre ?? song?.genre ?? song?.meta?.genre ?? "");
  const disabled = (reason) => ({
    song,
    diagnostics: Object.freeze({
      version: TRAP_STAGED_BUILD_VERSION,
      attempted: false,
      accepted: false,
      changed: false,
      reason,
      genre,
      candidateLimit: 1,
      candidatesEvaluated: 0,
    }),
  });

  if (config?.trapStagedBuild !== true) return disabled("disabled");
  if (genre !== "trap") return disabled("genre-not-eligible");
  if (Number.isFinite(Number(config?.evolution)) && finite(config.evolution) <= 0.001) {
    return disabled("evolution-off");
  }

  const candidate = buildCandidate(song, config);
  if (!candidate) return disabled("no-safe-staged-build-opportunity");

  const before = evaluateCandidate(song);
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeFloor = creativeFloor(before);
  const afterFloor = creativeFloor(after);
  const deltas = computeProtectedDeltas(before, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = afterFloor - beforeFloor;
  const protectedSafe = Object.values(deltas).every((delta) => delta >= -0.75);
  const accepted = Boolean(
    release?.passed
    && finite(after?.diagnostics?.scaleFit, 1) >= 0.999999
    && protectedSafe
    && scoreDelta >= -0.35
    && floorDelta >= -0.75
  );
  const diagnostics = Object.freeze({
    version: TRAP_STAGED_BUILD_VERSION,
    attempted: true,
    accepted,
    changed: true,
    reason: !release?.passed ? "release-gate"
      : !protectedSafe ? "protected-dimension-regression"
        : accepted ? "staged-build-win" : "critic-regression",
    genre,
    candidateLimit: 1,
    candidatesEvaluated: 1,
    edits: candidate.edits.length,
    sections: [...new Set(candidate.edits.map((edit) => edit.sectionId).filter(Boolean))],
    roles: [...new Set(candidate.edits.map((edit) => edit.role))],
    scoreDelta: round(scoreDelta, 2),
    floorDelta: round(floorDelta, 2),
    protectedDeltas: Object.fromEntries(Object.entries(deltas).map(([key, value]) => [key, round(value, 2)])),
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
        trapStagedBuild: diagnostics,
      },
    },
  };
  return { song: candidate.song, diagnostics };
}
