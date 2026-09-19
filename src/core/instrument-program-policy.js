function hashNumber(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniquePrograms(values = []) {
  return [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 127))];
}

function familyIndex(order = [], family) {
  const index = order.indexOf(family);
  return index === -1 ? order.length + 1 : index;
}

export const TRACK_SOUND_ROLE_GOALS = Object.freeze({
  drums: Object.freeze({
    label: "kit identity and groove authority",
    paletteLimit: 3,
    fallbackLimit: 5,
    familyOrder: Object.freeze(["tr", "electronic", "power", "room", "acoustic"]),
  }),
  bass: Object.freeze({
    label: "low-end movement and weight",
    paletteLimit: 3,
    fallbackLimit: 5,
    familyOrder: Object.freeze(["sub", "synth", "slap", "fingered", "picked", "fretless", "upright", "hybrid"]),
  }),
  chords: Object.freeze({
    label: "harmonic body",
    paletteLimit: 3,
    fallbackLimit: 6,
    familyOrder: Object.freeze(["warm-keys", "organ", "piano", "guitar", "brass", "synth", "choir", "mallet", "pad"]),
  }),
  melody: Object.freeze({
    label: "foreground hook",
    paletteLimit: 4,
    fallbackLimit: 6,
    familyOrder: Object.freeze(["voice", "air", "guitar", "string", "reed", "synth", "digital", "brass", "hybrid"]),
  }),
  counterpoint: Object.freeze({
    label: "supporting answer voice",
    paletteLimit: 4,
    fallbackLimit: 6,
    familyOrder: Object.freeze(["mallet", "air", "voice", "guitar", "string", "reed", "synth", "digital", "brass", "texture"]),
  }),
  pad: Object.freeze({
    label: "atmosphere only when it adds space",
    paletteLimit: 3,
    fallbackLimit: 5,
    familyOrder: Object.freeze(["warm-pad", "glass", "string-pad", "choir-pad", "synth-pad", "texture"]),
  }),
});

const TRACK_COMPANIONS = Object.freeze({
  drums: Object.freeze(["bass"]),
  bass: Object.freeze(["drums"]),
  chords: Object.freeze(["melody", "counterpoint", "pad"]),
  melody: Object.freeze(["counterpoint", "chords", "pad"]),
  counterpoint: Object.freeze(["melody", "chords", "pad"]),
  pad: Object.freeze(["melody", "counterpoint", "chords"]),
});

const PROGRAM_FAMILIES = Object.freeze({
  drums: Object.freeze({
    0: "acoustic",
    8: "room",
    16: "power",
    24: "electronic",
    25: "tr",
  }),
  bass: Object.freeze({
    32: "upright",
    33: "fingered",
    34: "picked",
    35: "fretless",
    36: "slap",
    37: "slap",
    38: "sub",
    39: "synth",
    43: "upright",
    87: "hybrid",
    88: "sub",
  }),
  chords: Object.freeze({
    0: "piano",
    4: "warm-keys",
    5: "warm-keys",
    6: "mallet",
    7: "guitar",
    11: "mallet",
    12: "mallet",
    16: "organ",
    17: "organ",
    19: "organ",
    24: "guitar",
    25: "guitar",
    27: "guitar",
    29: "guitar",
    30: "guitar",
    48: "choir",
    52: "choir",
    61: "brass",
    62: "brass",
    81: "synth",
    89: "pad",
    90: "synth",
    95: "pad",
  }),
  melody: Object.freeze({
    24: "guitar",
    25: "guitar",
    26: "guitar",
    29: "guitar",
    30: "guitar",
    40: "string",
    56: "brass",
    65: "reed",
    68: "reed",
    71: "reed",
    73: "air",
    80: "synth",
    81: "synth",
    82: "digital",
    84: "digital",
    85: "voice",
    86: "synth",
    87: "hybrid",
  }),
  counterpoint: Object.freeze({
    10: "mallet",
    11: "mallet",
    14: "texture",
    24: "guitar",
    25: "guitar",
    27: "guitar",
    29: "guitar",
    40: "string",
    48: "string",
    53: "voice",
    56: "brass",
    65: "reed",
    71: "reed",
    73: "air",
    80: "synth",
    81: "synth",
    82: "digital",
    84: "digital",
    85: "voice",
    86: "synth",
    98: "texture",
  }),
  pad: Object.freeze({
    48: "string-pad",
    51: "string-pad",
    52: "choir-pad",
    54: "choir-pad",
    88: "glass",
    89: "warm-pad",
    90: "synth-pad",
    91: "choir-pad",
    92: "glass",
    93: "texture",
    94: "glass",
    95: "synth-pad",
    96: "texture",
    99: "texture",
  }),
});

const ELEMENT_FAMILY_PRIORITIES = Object.freeze({
  fire: Object.freeze({
    drums: Object.freeze(["power", "tr", "electronic", "room", "acoustic"]),
    bass: Object.freeze(["slap", "hybrid", "synth", "sub", "picked", "fingered", "fretless", "upright"]),
    chords: Object.freeze(["brass", "guitar", "synth", "organ", "warm-keys", "piano", "choir", "mallet", "pad"]),
    melody: Object.freeze(["synth", "digital", "brass", "guitar", "string", "reed", "voice", "air", "hybrid"]),
    counterpoint: Object.freeze(["synth", "digital", "brass", "guitar", "reed", "voice", "air", "string", "mallet", "texture"]),
    pad: Object.freeze(["synth-pad", "texture", "warm-pad", "glass", "string-pad", "choir-pad"]),
  }),
  electric: Object.freeze({
    drums: Object.freeze(["electronic", "tr", "power", "room", "acoustic"]),
    bass: Object.freeze(["synth", "hybrid", "sub", "slap", "fingered", "picked", "fretless", "upright"]),
    chords: Object.freeze(["synth", "brass", "organ", "guitar", "warm-keys", "piano", "pad", "choir", "mallet"]),
    melody: Object.freeze(["digital", "synth", "hybrid", "voice", "air", "reed", "guitar", "string", "brass"]),
    counterpoint: Object.freeze(["digital", "synth", "texture", "air", "voice", "reed", "guitar", "string", "brass", "mallet"]),
    pad: Object.freeze(["synth-pad", "glass", "texture", "warm-pad", "choir-pad", "string-pad"]),
  }),
  drip: Object.freeze({
    drums: Object.freeze(["room", "acoustic", "electronic", "tr", "power"]),
    bass: Object.freeze(["fretless", "upright", "sub", "fingered", "picked", "synth", "hybrid", "slap"]),
    chords: Object.freeze(["warm-keys", "piano", "pad", "choir", "guitar", "organ", "mallet", "synth", "brass"]),
    melody: Object.freeze(["air", "voice", "guitar", "string", "reed", "digital", "synth", "brass", "hybrid"]),
    counterpoint: Object.freeze(["mallet", "air", "voice", "string", "guitar", "reed", "texture", "digital", "synth", "brass"]),
    pad: Object.freeze(["warm-pad", "glass", "choir-pad", "texture", "string-pad", "synth-pad"]),
  }),
});

export function companionTrackIds(trackId) {
  return [...(TRACK_COMPANIONS[String(trackId)] ?? [])];
}

export function programFamilyForTrack(trackId, program) {
  const family = PROGRAM_FAMILIES[String(trackId)]?.[Number(program)];
  return family || `gm-${Math.max(0, Math.round(Number(program) || 0))}`;
}

export function elementFamilyPriorities(trackId, elementId) {
  return [...(ELEMENT_FAMILY_PRIORITIES[String(elementId || "").toLowerCase()]?.[String(trackId)] ?? TRACK_SOUND_ROLE_GOALS[String(trackId)]?.familyOrder ?? [])];
}

export function curateTrackProgramPalette(trackId, programs = [], {
  limit = TRACK_SOUND_ROLE_GOALS[String(trackId)]?.paletteLimit ?? uniquePrograms(programs).length,
  familyOrder = TRACK_SOUND_ROLE_GOALS[String(trackId)]?.familyOrder ?? [],
} = {}) {
  const unique = uniquePrograms(programs);
  if (!unique.length) return [];
  if (limit >= unique.length && !familyOrder.length) return unique;
  const annotated = unique.map((program, index) => ({
    program,
    index,
    family: programFamilyForTrack(trackId, program),
  })).sort((left, right) => (
    familyIndex(familyOrder, left.family) - familyIndex(familyOrder, right.family)
      || left.index - right.index
  ));
  const picked = [];
  const seenFamilies = new Set();
  for (const entry of annotated) {
    if (picked.length >= limit) break;
    if (seenFamilies.has(entry.family)) continue;
    picked.push(entry.program);
    seenFamilies.add(entry.family);
  }
  for (const entry of annotated) {
    if (picked.length >= limit) break;
    if (picked.includes(entry.program)) continue;
    picked.push(entry.program);
  }
  return picked;
}

export function mergeTrackProgramPalettes(trackId, ...palettes) {
  const goal = TRACK_SOUND_ROLE_GOALS[String(trackId)];
  return curateTrackProgramPalette(trackId, palettes.flat(), {
    limit: Math.max(goal?.paletteLimit ?? 3, 4),
    familyOrder: goal?.familyOrder ?? [],
  });
}

function grooveFamilyBias(trackId, companionProgramsByTrack = {}) {
  if (trackId === "bass") {
    const drumFamily = programFamilyForTrack("drums", companionProgramsByTrack.drums);
    return ["electronic", "tr"].includes(drumFamily)
      ? ["sub", "synth", "hybrid", "slap", "fingered", "picked"]
      : ["fingered", "picked", "fretless", "slap", "upright", "sub", "synth"];
  }
  if (trackId === "drums") {
    const bassFamily = programFamilyForTrack("bass", companionProgramsByTrack.bass);
    return ["sub", "synth", "hybrid"].includes(bassFamily)
      ? ["electronic", "tr", "power", "room", "acoustic"]
      : ["room", "acoustic", "power", "electronic", "tr"];
  }
  return TRACK_SOUND_ROLE_GOALS[String(trackId)]?.familyOrder ?? [];
}

const BRIGHT_FOREGROUND_FAMILIES = new Set(["synth", "digital", "brass", "hybrid"]);

function familyCollisionPenalty(trackId, candidateFamily, companionProgramsByTrack = {}) {
  if (["melody", "counterpoint", "pad", "chords"].includes(trackId)) {
    let penalty = 0;
    for (const companionId of companionTrackIds(trackId)) {
      const companionFamily = programFamilyForTrack(companionId, companionProgramsByTrack[companionId]);
      if (candidateFamily === companionFamily) penalty += companionId === "pad" ? 8 : 12;
      if (
        ["melody", "counterpoint"].includes(trackId)
        && ["melody", "counterpoint"].includes(companionId)
        && BRIGHT_FOREGROUND_FAMILIES.has(candidateFamily)
        && BRIGHT_FOREGROUND_FAMILIES.has(companionFamily)
      ) {
        penalty += 6;
      }
    }
    return penalty;
  }
  return 0;
}

export function rankAutoProgramCandidates({
  trackId,
  currentProgram,
  genrePrograms = [],
  fallbackPrograms = [],
  companionProgramsByTrack = {},
  explore = false,
  seed = "song",
  getCharacter = null,
} = {}) {
  const goal = TRACK_SOUND_ROLE_GOALS[String(trackId)] ?? {};
  const genrePalette = curateTrackProgramPalette(trackId, genrePrograms, {
    limit: goal.paletteLimit ?? uniquePrograms(genrePrograms).length,
    familyOrder: grooveFamilyBias(trackId, companionProgramsByTrack),
  });
  const fallbackPalette = curateTrackProgramPalette(trackId, fallbackPrograms, {
    limit: goal.fallbackLimit ?? uniquePrograms(fallbackPrograms).length,
    familyOrder: grooveFamilyBias(trackId, companionProgramsByTrack),
  });
  const pool = uniquePrograms(explore ? [...genrePalette, ...fallbackPalette] : genrePalette.length ? genrePalette : fallbackPalette);
  const currentFamily = programFamilyForTrack(trackId, currentProgram);
  const currentCharacter = typeof getCharacter === "function" ? String(getCharacter(currentProgram) || "") : "";
  const familyOrder = grooveFamilyBias(trackId, companionProgramsByTrack);
  return pool
    .map((program, index) => {
      const family = programFamilyForTrack(trackId, program);
      const character = typeof getCharacter === "function" ? String(getCharacter(program) || "") : "";
      const collisionPenalty = familyCollisionPenalty(trackId, family, companionProgramsByTrack);
      const score = 120
        - index * 3
        - familyIndex(familyOrder, family) * 2
        - collisionPenalty
        + (program === Number(currentProgram) ? -40 : 14)
        + (family === currentFamily ? -6 : 9)
        + (character && character === currentCharacter ? -8 : 4);
      return {
        program,
        score,
        tie: hashNumber(`${seed}:${trackId}:${program}`),
      };
    })
    .sort((left, right) => right.score - left.score || left.tie - right.tie)
    .map(({ program }) => program);
}

export function chooseAutoProgramRotation(options = {}) {
  const ranked = rankAutoProgramCandidates(options);
  if (!ranked.length) return Number.isFinite(Number(options.currentProgram)) ? Number(options.currentProgram) : null;
  const currentProgram = Number(options.currentProgram);
  const alternatives = ranked.filter((program) => program !== currentProgram);
  const rotationPool = alternatives.length ? alternatives : ranked;
  const foreground = ["melody", "counterpoint"].includes(String(options.trackId));
  const windowSize = foreground
    ? (options.explore ? 4 : 3)
    : (options.explore ? 3 : 2);
  const topWindow = rotationPool.slice(0, windowSize);
  if (topWindow.length === 1) return topWindow[0];
  return topWindow[hashNumber(`${options.seed}:${options.trackId}:rotation`) % topWindow.length];
}
