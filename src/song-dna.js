/**
 * Backward-compatible Song DNA facade.
 *
 * The canonical implementation lives in src/core/song-dna.js. This module
 * keeps the older ArrangementEngine API stable while removing clock/crypto
 * identity so the same musical inputs always produce the same DNA.
 */

import { createSongDNA as createCoreSongDNA } from "./core/song-dna.js";

export const SECTION_TYPES = Object.freeze({
  INTRO: "intro",
  VERSE: "verse",
  PRECHORUS: "preChorus",
  CHORUS: "chorus",
  BRIDGE: "bridge",
  BREAKDOWN: "breakdown",
  SOLO: "solo",
  OUTRO: "outro",
});

export const DEFAULT_ARRANGEMENTS = Object.freeze({
  pop: ["intro", "verse", "preChorus", "chorus", "verse", "chorus", "bridge", "chorus", "outro"],
  hipHop: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
  trap: ["intro", "verse", "hook", "verse", "hook", "outro"],
  house: ["intro", "build", "drop", "break", "drop", "outro"],
  techno: ["intro", "groove", "build", "drop", "break", "drop", "outro"],
});

export function sectionEnergy(section) {
  switch (section) {
    case "intro": return 0.35;
    case "verse": return 0.55;
    case "preChorus": return 0.72;
    case "chorus": return 1;
    case "hook": return 0.96;
    case "build": return 0.78;
    case "drop": return 1;
    case "bridge": return 0.65;
    case "solo": return 0.82;
    case "breakdown":
    case "break": return 0.45;
    case "groove": return 0.72;
    case "outro": return 0.28;
    default: return 0.5;
  }
}

export function sectionBars(section) {
  switch (section) {
    case "intro": return 8;
    case "verse": return 16;
    case "preChorus": return 8;
    case "chorus": return 16;
    case "hook": return 8;
    case "build": return 8;
    case "drop": return 16;
    case "bridge": return 8;
    case "solo": return 16;
    case "breakdown":
    case "break": return 8;
    case "groove": return 16;
    case "outro": return 8;
    default: return 8;
  }
}

export function buildSongArrangement(genre = "pop") {
  const form = DEFAULT_ARRANGEMENTS[genre] ?? DEFAULT_ARRANGEMENTS.pop;
  return form.map((section) => ({
    type: section,
    bars: sectionBars(section),
    energy: sectionEnergy(section),
  }));
}

function legacyStructure(genre) {
  const occurrences = new Map();
  return buildSongArrangement(genre).map((section) => {
    const occurrence = (occurrences.get(section.type) ?? 0) + 1;
    occurrences.set(section.type, occurrence);
    return {
      id: `${section.type}-${occurrence}`,
      name: section.type,
      bars: section.bars,
      intensity: section.energy,
    };
  });
}

export function createSongDNA({
  genre = "pop",
  bpm = 120,
  key = "C",
  scale = "major",
  seed = "0",
  progression = null,
} = {}) {
  const dna = createCoreSongDNA({
    genre,
    bpm,
    key,
    scale,
    seed,
    progression,
    narrativeId: "legacy-arrangement",
    structure: legacyStructure(genre),
  });

  // Compatibility aliases for the older ArrangementEngine surface.
  return {
    ...dna,
    genre,
    bpm: dna.tempo,
    key,
    scale,
    seed,
    progression,
    motifA: null,
    motifB: null,
    grooveSeed: dna.seeds.rhythm,
    melodySeed: dna.seeds.melody,
    rhythmSeed: dna.seeds.rhythm,
    harmonySeed: dna.seeds.harmony,
    energyCurve: [...dna.arrangement.energyArc],
  };
}
