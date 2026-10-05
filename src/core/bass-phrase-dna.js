const BASE_STEPS = 16;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
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

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => round(value)))].sort((a, b) => a - b);
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

function cell(id, steps, {
  roles = ["body", "payoff"],
  density = 0.6,
  character = "balanced",
} = {}) {
  return Object.freeze({
    id,
    steps: Object.freeze(steps),
    roles: Object.freeze(roles),
    density,
    character,
  });
}

/**
 * Original symbolic bass vocabulary for MIDI Arcade.
 *
 * Cells are rhythm/phrase instructions on a 16-step reference grid. They do
 * not encode copyrighted MIDI, pitches, presets, or audio. Harmony and note
 * rendering remain owned by MIDI Arcade's existing composition engine.
 */
export const BASS_PHRASE_DNA = Object.freeze({
  hipHop: Object.freeze([
    cell("hiphop-pocket-answer-a", [0, 3, 8, 14], { density: 0.56, character: "late-answer" }),
    cell("hiphop-pocket-answer-b", [0, 6, 10, 15], { density: 0.6, character: "short-reply" }),
    cell("hiphop-breathing-root-a", [0, 7, 12], { density: 0.46, character: "breathing" }),
    cell("hiphop-turnaround-a", [0, 8, 11, 15], { roles: ["payoff", "contrast"], density: 0.64, character: "turnaround" }),
  ]),
  trap: Object.freeze([
    cell("trap-808-anchor-a", [0, 6, 10, 13], { density: 0.64, character: "anchor-reply" }),
    cell("trap-808-anchor-b", [0, 5, 8, 14], { density: 0.62, character: "half-time-reply" }),
    cell("trap-808-sustain-a", [0, 8, 11], { density: 0.48, character: "sustain-space" }),
    cell("trap-808-turnaround-a", [0, 8, 13, 15], { roles: ["payoff", "contrast"], density: 0.66, character: "turnaround" }),
  ]),
  pop: Object.freeze([
    cell("pop-bass-pulse-a", [0, 4, 8, 12], { density: 0.62, character: "pulse" }),
    cell("pop-bass-lift-a", [0, 6, 8, 14], { density: 0.64, character: "lifted-reply" }),
    cell("pop-bass-hook-a", [0, 4, 10, 12, 15], { roles: ["payoff"], density: 0.72, character: "hook-support" }),
    cell("pop-bass-breath-a", [0, 8, 14], { density: 0.5, character: "breathing" }),
  ]),
  house: Object.freeze([
    cell("house-offbeat-a", [2, 6, 10, 14], { density: 0.72, character: "offbeat" }),
    cell("house-offbeat-b", [2, 7, 10, 15], { density: 0.68, character: "syncopated-offbeat" }),
    cell("house-pump-a", [2, 6, 11, 14], { density: 0.7, character: "pump" }),
    cell("house-turnaround-a", [2, 6, 10, 13, 15], { roles: ["payoff", "contrast"], density: 0.78, character: "turnaround" }),
  ]),
  neoSoul: Object.freeze([
    cell("neosoul-elastic-a", [0, 5, 10, 15], { density: 0.58, character: "elastic-answer" }),
    cell("neosoul-elastic-b", [1, 6, 9, 14], { density: 0.6, character: "anticipated-answer" }),
    cell("neosoul-space-a", [0, 7, 11], { density: 0.46, character: "breathing" }),
    cell("neosoul-turnaround-a", [0, 6, 11, 15], { roles: ["payoff", "contrast"], density: 0.66, character: "turnaround" }),
  ]),
  general: Object.freeze([
    cell("general-support-a", [0, 8, 12], { density: 0.5, character: "support" }),
    cell("general-support-b", [0, 6, 10, 14], { density: 0.6, character: "balanced" }),
  ]),
});

const MODE_RECIPES = Object.freeze({
  "lock-and-answer": Object.freeze({
    lockRatio: 0.42,
    replyOffsetsBeats: Object.freeze([0.25]),
    replyChance: 0.72,
    phraseChance: 0.52,
  }),
  "808-interlock": Object.freeze({
    lockRatio: 0.62,
    replyOffsetsBeats: Object.freeze([0.25]),
    replyChance: 0.66,
    phraseChance: 0.46,
  }),
  "pulse-reinforcement": Object.freeze({
    lockRatio: 0.72,
    replyOffsetsBeats: Object.freeze([0.5]),
    replyChance: 0.42,
    phraseChance: 0.34,
  }),
  "bass-forward-lock-and-answer": Object.freeze({
    lockRatio: 0.68,
    replyOffsetsBeats: Object.freeze([0.25, 0.5]),
    replyChance: 0.5,
    phraseChance: 0.42,
  }),
  "syncopated-pop-reply": Object.freeze({
    lockRatio: 0.46,
    replyOffsetsBeats: Object.freeze([0.5]),
    replyChance: 0.66,
    phraseChance: 0.54,
  }),
  "offbeat-interlock": Object.freeze({
    lockRatio: 0.88,
    replyOffsetsBeats: Object.freeze([]),
    replyChance: 0,
    phraseChance: 0.66,
  }),
  "offbeat-machine-interlock": Object.freeze({
    lockRatio: 0.9,
    replyOffsetsBeats: Object.freeze([]),
    replyChance: 0,
    phraseChance: 0.58,
  }),
  "elastic-answer": Object.freeze({
    lockRatio: 0.34,
    replyOffsetsBeats: Object.freeze([0.25, 0.5, 0.75]),
    replyChance: 0.58,
    phraseChance: 0.58,
  }),
  "dembow-lock-and-answer": Object.freeze({
    lockRatio: 0.58,
    replyOffsetsBeats: Object.freeze([0.5]),
    replyChance: 0.56,
    phraseChance: 0.44,
  }),
  "cross-rhythm-response": Object.freeze({
    lockRatio: 0.4,
    replyOffsetsBeats: Object.freeze([0.5, 0.75]),
    replyChance: 0.62,
    phraseChance: 0.6,
  }),
  "walking-quarter-dialogue": Object.freeze({
    lockRatio: 0.7,
    replyOffsetsBeats: Object.freeze([0.5]),
    replyChance: 0.28,
    phraseChance: 0.38,
  }),
  "riff-reinforcement": Object.freeze({
    lockRatio: 0.82,
    replyOffsetsBeats: Object.freeze([]),
    replyChance: 0,
    phraseChance: 0.3,
  }),
  "breakbeat-reply": Object.freeze({
    lockRatio: 0.52,
    replyOffsetsBeats: Object.freeze([0.25, 0.5]),
    replyChance: 0.64,
    phraseChance: 0.5,
  }),
  support: Object.freeze({
    lockRatio: 0.62,
    replyOffsetsBeats: Object.freeze([0.5]),
    replyChance: 0.44,
    phraseChance: 0.36,
  }),
});

function chooseCell(genre, sectionRole, seed) {
  const family = BASS_PHRASE_DNA[normalizeGenre(genre)] ?? BASS_PHRASE_DNA.general;
  const eligible = family.filter((entry) => entry.roles.includes(sectionRole));
  const pool = eligible.length ? eligible : family;
  const index = Math.min(pool.length - 1, Math.floor(randomUnit(`${seed}:bass-cell`) * pool.length));
  return pool[Math.max(0, index)];
}

function scaledCellSteps(cellSteps, gridSteps) {
  const factor = gridSteps / BASE_STEPS;
  return uniqueSorted((cellSteps ?? []).map((step) => finite(step) * factor));
}

function rankDeterministically(values, seed) {
  return [...values].sort((left, right) => {
    const a = randomUnit(`${seed}:rank:${left}`);
    const b = randomUnit(`${seed}:rank:${right}`);
    return a - b || left - right;
  });
}

function normalizeStep(step, gridSteps, wrap) {
  if (wrap) return ((step % gridSteps) + gridSteps) % gridSteps;
  return step >= 0 && step < gridSteps ? step : null;
}

function applyOpeningBoundary(steps, gridSteps, openingBoundary) {
  if (!openingBoundary) return steps;
  const midpoint = gridSteps / 2;
  return steps.filter((step) => step >= midpoint - 1e-6 || Math.abs(step) < 1e-6);
}

/**
 * Build a deterministic symbolic bass-rhythm plan from Groove DNA.
 *
 * The source lane remains authoritative for the pocket, while the selected
 * phrase cell adds an original MIDI Arcade vocabulary layer. This is a pure
 * planning function: it does not choose pitches or render notes.
 */
export function createBassPhrasePlan({
  genre = "general",
  relationship = {},
  sourceSteps = [],
  beatsPerStep = 0.25,
  gridSteps = BASE_STEPS,
  seed = "midi-arcade",
  sectionRole = "body",
  openingBoundary = false,
  density = 0.58,
  variation = 0.48,
  wrap = true,
} = {}) {
  const mode = String(relationship?.mode ?? "support");
  const recipe = MODE_RECIPES[mode] ?? MODE_RECIPES.support;
  const cell = chooseCell(genre, sectionRole, `${seed}:${mode}`);
  const source = uniqueSorted(sourceSteps);
  const locksWanted = Math.max(
    source.length ? 1 : 0,
    Math.min(source.length, Math.round(source.length * clamp(recipe.lockRatio, 0, 1))),
  );
  const locked = rankDeterministically(source, `${seed}:locks`)
    .slice(0, locksWanted);

  const replies = [];
  const replyStrength = clamp(
    recipe.replyChance * (0.72 + clamp(density, 0, 1) * 0.28),
    0,
    1,
  );
  for (const sourceStep of source) {
    for (const offsetBeats of recipe.replyOffsetsBeats) {
      if (randomUnit(`${seed}:reply:${sourceStep}:${offsetBeats}`) > replyStrength) continue;
      const step = sourceStep + offsetBeats / Math.max(1e-6, beatsPerStep);
      const normalized = normalizeStep(step, gridSteps, wrap);
      if (normalized != null) replies.push(normalized);
    }
  }

  const phraseSteps = scaledCellSteps(cell.steps, gridSteps);
  const phraseStrength = clamp(
    recipe.phraseChance
      * (0.74 + clamp(variation, 0, 1) * 0.26)
      * (0.82 + clamp(density, 0, 1) * 0.18),
    0,
    1,
  );
  const authored = phraseSteps.filter((step) => (
    randomUnit(`${seed}:phrase:${cell.id}:${step}`) <= phraseStrength
  ));

  let steps = uniqueSorted([...locked, ...replies, ...authored])
    .map((step) => normalizeStep(step, gridSteps, wrap))
    .filter((step) => step != null);

  steps = applyOpeningBoundary(uniqueSorted(steps), gridSteps, openingBoundary);

  // Preserve at least one authoritative source pulse when available. House and
  // machine-interlock sources are hats, so this still preserves offbeat motion
  // without forcing bass onto the kick.
  if (source.length && !steps.length) {
    const fallback = normalizeStep(source[0], gridSteps, wrap);
    if (fallback != null) steps = [fallback];
  }

  return Object.freeze({
    version: 1,
    id: `bass-phrase-dna:${cell.id}`,
    cellId: cell.id,
    genre: normalizeGenre(genre),
    mode,
    character: cell.character,
    sectionRole,
    steps: Object.freeze(uniqueSorted(steps)),
    targets: Object.freeze({
      lockRatio: round(recipe.lockRatio, 3),
      replyChance: round(recipe.replyChance, 3),
      phraseChance: round(recipe.phraseChance, 3),
      density: round(cell.density, 3),
    }),
  });
}

export function bassPhraseFamily(genre = "general") {
  return BASS_PHRASE_DNA[normalizeGenre(genre)] ?? BASS_PHRASE_DNA.general;
}
