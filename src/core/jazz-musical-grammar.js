const ARCHETYPE_ORDER = Object.freeze([
  "bebop",
  "cool",
  "hard-bop",
  "soul-jazz",
  "modal",
  "ballad",
  "latin",
  "contemporary",
]);

export const JAZZ_ARCHETYPES = Object.freeze({
  bebop: Object.freeze({
    id: "bebop",
    swing: 0.68,
    syncopation: 0.72,
    humanize: 0.4,
    walkingBias: 0.92,
    compingSpace: 0.48,
    phraseDensity: 0.82,
    harmonicMotion: "functional-fast",
  }),
  cool: Object.freeze({
    id: "cool",
    swing: 0.52,
    syncopation: 0.48,
    humanize: 0.5,
    walkingBias: 0.68,
    compingSpace: 0.72,
    phraseDensity: 0.5,
    harmonicMotion: "functional-spacious",
  }),
  "hard-bop": Object.freeze({
    id: "hard-bop",
    swing: 0.62,
    syncopation: 0.64,
    humanize: 0.46,
    walkingBias: 0.86,
    compingSpace: 0.54,
    phraseDensity: 0.7,
    harmonicMotion: "blues-functional",
  }),
  "soul-jazz": Object.freeze({
    id: "soul-jazz",
    swing: 0.46,
    syncopation: 0.58,
    humanize: 0.48,
    walkingBias: 0.54,
    compingSpace: 0.5,
    phraseDensity: 0.58,
    harmonicMotion: "blues-vamp",
  }),
  modal: Object.freeze({
    id: "modal",
    swing: 0.5,
    syncopation: 0.6,
    humanize: 0.52,
    walkingBias: 0.58,
    compingSpace: 0.7,
    phraseDensity: 0.62,
    harmonicMotion: "modal-open",
  }),
  ballad: Object.freeze({
    id: "ballad",
    swing: 0.34,
    syncopation: 0.34,
    humanize: 0.56,
    walkingBias: 0.42,
    compingSpace: 0.8,
    phraseDensity: 0.38,
    harmonicMotion: "functional-slow",
  }),
  latin: Object.freeze({
    id: "latin",
    swing: 0.18,
    syncopation: 0.76,
    humanize: 0.34,
    walkingBias: 0.6,
    compingSpace: 0.44,
    phraseDensity: 0.66,
    harmonicMotion: "latin-functional",
  }),
  contemporary: Object.freeze({
    id: "contemporary",
    swing: 0.42,
    syncopation: 0.66,
    humanize: 0.4,
    walkingBias: 0.64,
    compingSpace: 0.62,
    phraseDensity: 0.64,
    harmonicMotion: "color-functional",
  }),
});

export const JAZZ_PHRASE_TRANSFORMATIONS = Object.freeze([
  "approach-tone",
  "upper-neighbor",
  "lower-neighbor",
  "enclosure",
  "sequence",
  "motif-displacement",
  "rhythmic-diminution",
  "rhythmic-augmentation",
  "delayed-resolution",
  "anticipation",
]);

function genreOf(song) {
  return String(song?.genre ?? song?.meta?.genre ?? "").trim().toLowerCase();
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function explicitArchetype(song) {
  const value = String(
    song?.jazzArchetype
    ?? song?.meta?.jazzArchetype
    ?? song?.settings?.jazzArchetype
    ?? "",
  ).trim().toLowerCase();
  return JAZZ_ARCHETYPES[value] ? value : null;
}

export function jazzArchetypeForSong(song, seed = null) {
  if (genreOf(song) !== "jazz") return null;
  const explicit = explicitArchetype(song);
  const id = explicit ?? ARCHETYPE_ORDER[
    hashString(seed ?? song?.seed ?? song?.id ?? "jazz") % ARCHETYPE_ORDER.length
  ];
  return JAZZ_ARCHETYPES[id];
}

export function createJazzGrammarDirective(song, selection = {}) {
  const archetype = jazzArchetypeForSong(song);
  if (!archetype) return null;

  return Object.freeze({
    version: 1,
    archetype: Object.freeze({ ...archetype }),
    selection: Object.freeze({
      target: selection?.target ?? "song",
      sectionId: selection?.sectionId ?? null,
      trackId: selection?.trackId ?? null,
    }),
    harmony: Object.freeze({
      priorities: Object.freeze([
        "guide-tones-3rd-7th",
        "smooth-inner-voice-leading",
        "functional-or-modal-resolution",
        "extensions-after-shell-clarity",
      ]),
      extensionOrder: Object.freeze(["7th", "9th", "11th", "13th", "altered-dominant"]),
    }),
    walkingBass: Object.freeze({
      strongBeatTarget: "chord-tone",
      weakBeatTarget: "step-or-approach",
      nextHarmonyApproach: true,
      avoidRootOnlyRepetition: true,
      targetBias: archetype.walkingBias,
    }),
    comping: Object.freeze({
      preferGuideToneShells: true,
      avoidConstantBlockChords: true,
      allowAnticipation: true,
      spaceTarget: archetype.compingSpace,
    }),
    phrase: Object.freeze({
      transformations: JAZZ_PHRASE_TRANSFORMATIONS,
      densityTarget: archetype.phraseDensity,
      requireResolutionIntent: true,
      preserveMotifIdentity: true,
    }),
    chromaticism: Object.freeze({
      // Kept observation-only until the global scale/release contract can
      // distinguish intentional approach tones from genuinely wrong notes.
      executionEnabled: false,
      allowedWhenEnabled: Object.freeze([
        "single-semitone-approach",
        "enclosure",
        "chromatic-passing",
      ]),
      mustResolve: true,
      maxUnresolvedBeats: 0.75,
    }),
    fallback: Object.freeze({
      mode: "conservative-jazz",
      preferGuideTones: true,
      reduceChromaticism: true,
      reduceDensityBeforeHarmony: true,
      neverRelaxReleaseGate: true,
    }),
  });
}
