function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
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

function sectionBounds(section = {}) {
  const startBar = Math.max(0, Math.round(finite(section.startBar, 0)));
  const bars = Math.max(1, Math.round(finite(section.bars, 1)));
  return { startBar, bars };
}

export function createPatternEvolutionPlan({ section = {}, bar = 0 } = {}) {
  const { startBar, bars } = sectionBounds(section);
  const localBar = Math.max(0, Math.floor(finite(bar, startBar)) - startBar);
  const cycleBars = bars >= 4 ? 4 : bars;
  const cyclePosition = localBar % cycleBars;
  const cycleIndex = Math.floor(localBar / cycleBars);
  const family = cycleIndex % 2 === 0 ? "A" : "B";

  let role = family;
  if (cycleBars === 2 && cyclePosition === 1) role = `${family}-prime`;
  else if (cycleBars === 3 && cyclePosition === 2) role = `${family}-prime`;
  else if (cycleBars >= 4 && cyclePosition === 2) role = `${family}-prime`;
  else if (cycleBars >= 4 && cyclePosition === 3) role = `${family}-turnaround`;

  const mutationWindow = role.endsWith("turnaround")
    ? [0.75, 1]
    : role.endsWith("prime")
      ? [0.5, 1]
      : [0, 1];

  return Object.freeze({
    version: 2,
    family,
    role,
    cycleBars,
    cycleIndex,
    cyclePosition,
    memoryAnchorBar: Math.max(startBar, Math.floor(finite(bar, startBar)) - cyclePosition),
    mutationWindow: Object.freeze(mutationWindow),
    maxStepEdits: role.endsWith("turnaround") ? 2 : role.endsWith("prime") ? 1 : 0,
  });
}

export function patternEvolutionSeed({ seed = "midi-arcade", genre = "general", sectionId = "section", plan } = {}) {
  const safePlan = plan ?? createPatternEvolutionPlan();
  return `${String(seed)}:${String(genre)}:${String(sectionId)}:${safePlan.family}:${safePlan.memoryAnchorBar}`;
}

export function applyPatternEvolution({
  steps = [],
  allowedSteps = [],
  requiredSteps = [],
  protectedSteps = [],
  gridSteps = 16,
  plan = null,
  variation = 0.5,
  seed = "pattern-evolution",
  lane = "percussion",
} = {}) {
  const base = uniqueSorted(steps);
  const safePlan = plan ?? createPatternEvolutionPlan();
  const amount = clamp(variation, 0, 1);

  if (safePlan.maxStepEdits <= 0 || lane === "snare" || amount <= 0.05) {
    return Object.freeze({
      steps: Object.freeze(base),
      edits: Object.freeze([]),
    });
  }

  const grid = Math.max(1, finite(gridSteps, 16));
  const required = new Set(requiredSteps.map((step) => round(step)));
  const protectedSet = new Set(protectedSteps.map((step) => round(step)));
  const existing = new Set(base.map((step) => round(step)));
  const [windowStart, windowEnd] = safePlan.mutationWindow;
  const minStep = grid * windowStart;
  const maxStep = grid * windowEnd;
  const inWindow = (step) => step >= minStep - 1e-6 && step < maxStep - 1e-6;

  const additions = uniqueSorted(allowedSteps)
    .filter((step) => (
      inWindow(step)
      && !existing.has(round(step))
      && !protectedSet.has(round(step))
    ))
    .sort((left, right) => (
      randomUnit(`${seed}:add:${right}`) - randomUnit(`${seed}:add:${left}`)
      || left - right
    ));

  const removals = base
    .filter((step) => (
      inWindow(step)
      && !required.has(round(step))
      && !protectedSet.has(round(step))
    ))
    .sort((left, right) => (
      randomUnit(`${seed}:remove:${right}`) - randomUnit(`${seed}:remove:${left}`)
      || left - right
    ));

  let evolved = [...base];
  const edits = [];
  const preferAdd = additions.length > 0
    && (removals.length === 0 || randomUnit(`${seed}:mode`) < 0.68);

  if (preferAdd) {
    evolved.push(additions[0]);
    edits.push(Object.freeze({ type: "add", step: additions[0] }));
  } else if (removals.length) {
    evolved = evolved.filter((step) => Math.abs(step - removals[0]) > 1e-6);
    edits.push(Object.freeze({ type: "remove", step: removals[0] }));
  }

  if (safePlan.maxStepEdits > 1 && amount >= 0.62 && edits.length < safePlan.maxStepEdits) {
    const after = new Set(evolved.map((step) => round(step)));
    const secondAdd = additions.find((step) => !after.has(round(step)));
    if (secondAdd != null) {
      evolved.push(secondAdd);
      edits.push(Object.freeze({ type: "add", step: secondAdd }));
    }
  }

  const allowed = new Set([...allowedSteps, ...requiredSteps].map((step) => round(step)));
  const safeSteps = uniqueSorted(evolved).filter((step) => (
    allowed.has(round(step))
    && !protectedSet.has(round(step))
  ));
  for (const requiredStep of requiredSteps) {
    if (!protectedSet.has(round(requiredStep))) safeSteps.push(requiredStep);
  }

  return Object.freeze({
    steps: Object.freeze(uniqueSorted(safeSteps)),
    edits: Object.freeze(edits),
  });
}
