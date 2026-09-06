/**
 * Deterministic Song DNA contract.
 *
 * This module is intentionally pure: no DOM, clock, crypto, or ambient state.
 * A seed plus musical inputs always yields the same identity. Related
 * generations can inherit a family while receiving a new deterministic
 * instance id from their new seed.
 */

const UINT32_MAX = 0xFFFFFFFF;

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

export function hashSongDNA(value) {
  const text = String(value ?? "");
  let hash = 0x811C9DC5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function domainSeed(base, domain) {
  return hashSongDNA(`${base}|${domain}`);
}

function select(values, seed) {
  return values[Math.abs(seed) % values.length];
}

function normalizedStructure(structure = []) {
  const occurrences = new Map();
  return structure.map((section, index) => {
    const name = String(section?.name ?? section?.type ?? "idea").toLowerCase();
    const occurrence = occurrences.get(name) ?? 0;
    occurrences.set(name, occurrence + 1);
    return {
      id: String(section?.id ?? `${name}-${occurrence + 1}`),
      name,
      index,
      occurrence,
      bars: Math.max(1, Math.round(finite(section?.bars, 1))),
      intensity: clamp(section?.intensity ?? section?.energy ?? 0.8, 0, 1.25),
    };
  });
}

function grooveFamily(genre, drumGroove) {
  if (drumGroove) return String(drumGroove);
  if (["house", "techno", "synthwave", "synthPopRadio"].includes(genre)) return "fourFloor";
  if (["trap", "drill"].includes(genre)) return "halfTime";
  if (genre === "drumBass") return "breakbeat";
  if (["reggaeton", "afrobeats"].includes(genre)) return "clave-pocket";
  return "backbeat";
}

function harmonicFamily(scale, seed) {
  const modal = ["dorian", "phrygian", "lydian", "mixolydian", "locrian"].includes(scale);
  const tense = ["harmonicMinor", "phrygianDominant", "altered", "hungarianMinor"].includes(scale);
  if (modal) return select(["modal-center", "modal-journey"], seed);
  if (tense) return select(["tension-release", "chromatic-gravity"], seed);
  return select(["functional-arc", "color-cycle", "pedal-release"], seed);
}

function melodicRangeClass(value) {
  const range = finite(value, 10);
  if (range <= 7) return "focused";
  if (range >= 15) return "wide";
  return "balanced";
}

function immutableIdentity(sourceDNA) {
  return sourceDNA?.version >= 2 && sourceDNA?.identity ? sourceDNA.identity : null;
}

/**
 * Create deterministic musical identity before track rendering.
 */
export function createSongDNA({
  genre = "pop",
  bpm = 120,
  key = "C",
  scale = "major",
  seed = "0",
  progression = null,
  narrativeId = "lift-release",
  styleAnchor = {},
  structure = [],
  sourceDNA = null,
  syncopation = 0.5,
  swing = 0,
  melodicRange = 10,
  melodicDirection = null,
  phraseBars = 4,
} = {}) {
  const seedText = String(seed ?? "0");
  const normalizedGenre = String(genre ?? "pop");
  const normalizedKey = String(key ?? "C");
  const normalizedScale = String(scale ?? "major");
  const sourceIdentity = immutableIdentity(sourceDNA);
  const familyBasis = sourceDNA?.familyId
    ?? `${normalizedGenre}|${normalizedKey}|${normalizedScale}|${narrativeId}|${seedText}`;
  const familyHash = sourceDNA?.familyId
    ? hashSongDNA(sourceDNA.familyId)
    : hashSongDNA(familyBasis);
  const instanceHash = hashSongDNA([
    familyBasis,
    seedText,
    normalizedGenre,
    round(bpm, 2),
    normalizedKey,
    normalizedScale,
    sourceDNA?.id ?? "root",
  ].join("|"));
  const identitySeed = sourceDNA?.identitySeed ?? domainSeed(familyHash, "identity");
  const sections = normalizedStructure(structure);
  const direction = sourceDNA?.melodic?.direction
    ?? ([1, -1].includes(melodicDirection)
      ? melodicDirection
      : (domainSeed(identitySeed, "melodic-direction") % 2 === 0 ? 1 : -1));
  const shape = sourceDNA?.melodic?.shape
    ?? String(styleAnchor?.melodyShape ?? select(["arch", "rising", "falling", "wave"], domainSeed(identitySeed, "melodic-shape")));
  const pocket = sourceDNA?.rhythmic?.pocket
    ?? grooveFamily(normalizedGenre, styleAnchor?.drumGroove);
  const harmonicMotion = sourceDNA?.harmonic?.motion
    ?? harmonicFamily(normalizedScale, domainSeed(identitySeed, "harmonic-motion"));
  const arrangementArc = sourceDNA?.arrangement?.arc ?? String(narrativeId || "lift-release");
  const signatureBias = sourceIdentity?.signatureBias
    ?? select(["hook", "groove", "harmony", "dialogue"], domainSeed(identitySeed, "signature-bias"));

  const domainSeeds = {
    harmony: domainSeed(instanceHash, "harmony"),
    rhythm: domainSeed(instanceHash, "rhythm"),
    melody: domainSeed(instanceHash, "melody"),
    arrangement: domainSeed(instanceHash, "arrangement"),
    performance: domainSeed(instanceHash, "performance"),
  };
  const energyArc = sections.map((section) => round(clamp(section.intensity / 1.18, 0.12, 1)));
  const dnaSections = sections.map((section) => ({
    sectionId: section.id,
    sectionName: section.name,
    occurrence: section.occurrence,
    energyTarget: energyArc[section.index],
    developmentSeed: domainSeed(domainSeeds.arrangement, `${section.id}|development`),
    phraseSeed: domainSeed(domainSeeds.melody, `${section.id}|phrase`),
    grooveSeed: domainSeed(domainSeeds.rhythm, `${section.name}|${section.occurrence}|groove`),
  }));

  return {
    version: 2,
    id: `dna-${instanceHash.toString(36)}`,
    familyId: sourceDNA?.familyId ?? `dna-family-${familyHash.toString(36)}`,
    identitySeed,
    revision: sourceDNA?.version >= 2 ? Math.max(0, Math.round(finite(sourceDNA.revision, 0))) + 1 : 0,
    identity: {
      genre: sourceIdentity?.genre ?? normalizedGenre,
      key: sourceIdentity?.key ?? normalizedKey,
      scale: sourceIdentity?.scale ?? normalizedScale,
      narrative: sourceIdentity?.narrative ?? String(narrativeId || "lift-release"),
      signatureBias,
    },
    tempo: round(clamp(bpm, 20, 320), 2),
    progression: Array.isArray(progression) ? [...progression] : progression ?? null,
    harmonic: {
      motion: harmonicMotion,
      tonalCenter: `${normalizedKey}:${normalizedScale}`,
      cadenceGravity: sourceDNA?.harmonic?.cadenceGravity
        ?? round(0.62 + (domainSeed(identitySeed, "cadence-gravity") / UINT32_MAX) * 0.26),
    },
    rhythmic: {
      pocket,
      phraseBars: Math.max(2, Math.min(8, Math.round(finite(sourceDNA?.rhythmic?.phraseBars ?? phraseBars, 4)))),
      syncopation: sourceDNA?.rhythmic?.syncopation ?? round(clamp(syncopation, 0, 1)),
      swing: sourceDNA?.rhythmic?.swing ?? round(clamp(swing, 0, 1)),
      bassGroove: sourceDNA?.rhythmic?.bassGroove ?? String(styleAnchor?.bassGroove ?? "syncopated"),
    },
    melodic: {
      shape,
      direction,
      rangeClass: sourceDNA?.melodic?.rangeClass ?? melodicRangeClass(melodicRange),
      hookMemory: sourceDNA?.melodic?.hookMemory
        ?? round(0.68 + (domainSeed(identitySeed, "hook-memory") / UINT32_MAX) * 0.2),
    },
    arrangement: {
      arc: arrangementArc,
      sectionCount: sections.length,
      energyArc,
      contrastRotation: sourceDNA?.arrangement?.contrastRotation
        ?? domainSeed(identitySeed, "contrast-rotation") % 4,
    },
    styleAnchor: {
      drumGroove: String(styleAnchor?.drumGroove ?? pocket),
      bassGroove: String(styleAnchor?.bassGroove ?? "syncopated"),
      chordMotion: String(styleAnchor?.chordMotion ?? "sustained"),
      melodyShape: shape,
    },
    seeds: domainSeeds,
    sections: dnaSections,
  };
}

export function songDNASection(dna, sectionId) {
  return dna?.sections?.find((section) => section.sectionId === sectionId) ?? null;
}

export function sameSongDNAFamily(left, right) {
  return Boolean(left?.familyId && right?.familyId && left.familyId === right.familyId);
}
