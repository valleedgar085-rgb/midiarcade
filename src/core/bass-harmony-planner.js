function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed) {
  let state = hashString(seed) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

function normalizeGenre(value) {
  const raw = String(value ?? "general").toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    hiphop: "hipHop",
    rap: "hipHop",
    trap: "trap",
    drill: "trap",
    pop: "pop",
    popradio: "pop",
    house: "house",
    techno: "house",
    neosoul: "neoSoul",
    rnb: "neoSoul",
    rnbsoul: "neoSoul",
  }[raw] ?? "general";
}

function rootPc(chord) {
  if (Number.isFinite(Number(chord?.rootPc))) return mod12(chord.rootPc);
  if (Number.isFinite(Number(chord?.root))) return mod12(chord.root);
  const firstTone = chord?.tones?.[0];
  return Number.isFinite(Number(firstTone)) ? mod12(firstTone) : null;
}

function tonePcs(chord) {
  const root = rootPc(chord);
  const tones = [...new Set((chord?.tones ?? [])
    .filter((tone) => Number.isFinite(Number(tone)))
    .map(mod12))];
  if (root != null && !tones.includes(root)) tones.unshift(root);
  return tones;
}

function harmonicRole(bassGrooveRole, isLast, nextChord) {
  const role = String(bassGrooveRole ?? "movement");
  if (role === "anchor") return "ANCHOR";
  if (role === "pickup" || (isLast && nextChord)) return "ANTICIPATION";
  if (role.includes("response")) return "REPLY";
  return "MOVEMENT";
}

const GENRE_TARGET_RECIPES = Object.freeze({
  hipHop: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["fifth", "root", "chord"]),
    MOVEMENT: Object.freeze(["chord", "fifth", "root"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
  trap: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["root", "fifth", "root"]),
    MOVEMENT: Object.freeze(["fifth", "root", "chord"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
  pop: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["root", "fifth", "third"]),
    MOVEMENT: Object.freeze(["fifth", "third", "root"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
  house: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["root", "fifth"]),
    MOVEMENT: Object.freeze(["root", "fifth"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
  neoSoul: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["third", "fifth", "chord", "root"]),
    MOVEMENT: Object.freeze(["chord", "third", "fifth", "root"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
  general: Object.freeze({
    ANCHOR: Object.freeze(["root"]),
    REPLY: Object.freeze(["fifth", "root", "chord"]),
    MOVEMENT: Object.freeze(["chord", "fifth", "root"]),
    ANTICIPATION: Object.freeze(["nextRoot"]),
  }),
});

function fifthPc(root, tones) {
  if (root == null) return tones[0] ?? null;
  const perfectFifth = mod12(root + 7);
  return tones.includes(perfectFifth)
    ? perfectFifth
    : tones.find((tone) => tone !== root) ?? root;
}

function thirdPc(root, tones) {
  if (root == null) return tones[0] ?? null;
  const preferred = tones
    .map((tone) => ({ tone, distance: mod12(tone - root) }))
    .filter(({ distance }) => distance === 3 || distance === 4);
  return preferred[0]?.tone ?? tones.find((tone) => tone !== root) ?? root;
}

function chordPc(root, tones, seed) {
  const alternatives = tones.filter((tone) => tone !== root);
  const pool = alternatives.length ? alternatives : tones;
  if (!pool.length) return root;
  const index = Math.min(pool.length - 1, Math.floor(randomUnit(seed) * pool.length));
  return pool[Math.max(0, index)];
}

function targetPcForStrategy(strategy, chord, nextChord, seed) {
  const root = rootPc(chord);
  const tones = tonePcs(chord);
  if (strategy === "root") return root;
  if (strategy === "fifth") return fifthPc(root, tones);
  if (strategy === "third") return thirdPc(root, tones);
  if (strategy === "chord") return chordPc(root, tones, seed);
  if (strategy === "nextRoot") return rootPc(nextChord) ?? root;
  return root;
}

function nearestPitchForPc(referencePitch, pitchClass, {
  minimum = 28,
  maximum = 55,
  preferredMin = 35,
  preferredMax = 52,
} = {}) {
  if (!Number.isFinite(Number(referencePitch)) || pitchClass == null) return referencePitch;
  const reference = Number(referencePitch);
  const candidates = [];
  for (let pitch = mod12(pitchClass); pitch <= 127; pitch += 12) {
    if (pitch >= minimum && pitch <= maximum) candidates.push(pitch);
  }
  if (!candidates.length) return referencePitch;
  return candidates
    .slice()
    .sort((left, right) => {
      const leftPreferred = left >= preferredMin && left <= preferredMax ? 0 : 1;
      const rightPreferred = right >= preferredMin && right <= preferredMax ? 0 : 1;
      return leftPreferred - rightPreferred
        || Math.abs(left - reference) - Math.abs(right - reference)
        || left - right;
    })[0];
}

/**
 * Deterministic harmonic targeter for rendered bass events.
 *
 * Groove DNA still owns event timing. This planner only decides the semantic
 * harmonic job and a register-safe target pitch for an already-authored bass
 * event. Existing musical lookahead remains free to shape the final boundary
 * approach after this plan is applied.
 */
export function planBassHarmonyTarget({
  genre = "general",
  chord = null,
  nextChord = null,
  bassGrooveRole = "movement",
  currentPitch = 36,
  index = 0,
  eventCount = 1,
  seed = "midi-arcade",
  variation = 0.48,
  complexity = 0.58,
} = {}) {
  const family = normalizeGenre(genre);
  const isLast = Math.max(0, Math.round(finite(index))) >= Math.max(0, Math.round(finite(eventCount, 1)) - 1);
  const role = harmonicRole(bassGrooveRole, isLast, nextChord);
  const recipe = GENRE_TARGET_RECIPES[family] ?? GENRE_TARGET_RECIPES.general;
  const strategies = recipe[role] ?? GENRE_TARGET_RECIPES.general[role] ?? ["root"];

  // Higher variation/complexity can explore deeper into the approved harmonic
  // vocabulary, but selection is still fixed for the same seed and context.
  const exploration = clamp((finite(variation, 0.48) * 0.58) + (finite(complexity, 0.58) * 0.42), 0, 1);
  const usableCount = Math.max(1, Math.min(
    strategies.length,
    1 + Math.floor(exploration * Math.max(0, strategies.length - 1) + 1e-9),
  ));
  const pool = strategies.slice(0, usableCount);
  const selectionSeed = [
    seed,
    family,
    role,
    index,
    rootPc(chord),
    rootPc(nextChord),
  ].join(":");
  const strategyIndex = Math.min(pool.length - 1, Math.floor(randomUnit(selectionSeed) * pool.length));
  const strategy = pool[Math.max(0, strategyIndex)] ?? "root";
  const targetPitchClass = targetPcForStrategy(strategy, chord, nextChord, selectionSeed);
  const pitch = nearestPitchForPc(currentPitch, targetPitchClass);

  return Object.freeze({
    version: 1,
    id: "bass-harmony-planner-v1",
    genre: family,
    role,
    strategy,
    chordRootPc: rootPc(chord),
    nextChordRootPc: rootPc(nextChord),
    targetPitchClass,
    pitch,
    changed: Number.isFinite(Number(pitch)) && Number(pitch) !== Number(currentPitch),
  });
}
