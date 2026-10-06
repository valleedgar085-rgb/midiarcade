const MELODY_INTENT_VERSION = 1;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function shouldApplyMelodyIntentMutations(config = {}) {
  const genre = String(config?.genre ?? "");
  const secondaryGenre = String(config?.secondaryGenre ?? "").trim();
  return ["hipHop", "rap", "trap", "pop"].includes(genre)
    && secondaryGenre.length === 0
    && finite(config?.bars, 0) >= 12
    && finite(config?.variation, 0) >= 0.6;
}

const ROLE_BUDGETS = Object.freeze({
  "memory-anchor": 0,
  anchor: 0,
  pivot: 1,
  continuation: 1,
  passing: 1,
  approach: 2,
  answer: 2,
  "hook-signature": 2,
  "ornamental-run": 1,
  climax: 3,
  resolution: 1,
});

export function melodyIntentRole({
  sectionName,
  eventIndex = 0,
  eventCount = 1,
  progress = 0,
  phraseAnchor = false,
  memoryCore = false,
  developmentType = null,
  storyRole = null,
} = {}) {
  const name = normalizedName(sectionName);
  const development = normalizedName(developmentType);
  const story = normalizedName(storyRole);
  const last = eventIndex >= Math.max(0, eventCount - 1);
  const midpoint = eventIndex === Math.floor(Math.max(0, eventCount - 1) / 2);

  if (memoryCore) return "memory-anchor";
  if (eventIndex === 0) return "anchor";
  if (last) return "resolution";
  if (development === "climax" || development === "octavelift") return "climax";
  if (development === "answer" || story === "answer" || story === "declare-answer") return "answer";
  if (["prechorus", "build"].includes(name) && progress >= 0.45) return "approach";
  // In payoff sections the recognizable hook gesture outranks a generic
  // midpoint pivot. Short motifs often place both jobs on the same event.
  if (["chorus", "drop", "theme"].includes(name) && progress >= 0.3 && progress <= 0.76) {
    return "hook-signature";
  }
  if (phraseAnchor && midpoint) return "pivot";
  if (development === "resolution" || story === "resolve") return "resolution";
  if (development === "rhythm") return "passing";
  return "continuation";
}

export function melodicMovementBudget(role) {
  return ROLE_BUDGETS[role] ?? ROLE_BUDGETS.continuation;
}

export function constrainMelodicDegree({
  baseDegree,
  proposedDegree,
  role = "continuation",
  previousDegree = null,
} = {}) {
  const base = Math.round(finite(baseDegree, 0));
  const proposed = Math.round(finite(proposedDegree, base));
  const budget = melodicMovementBudget(role);
  let result = clamp(proposed, base - budget, base + budget);

  if (previousDegree != null && Number.isFinite(Number(previousDegree))) {
    const previous = Math.round(Number(previousDegree));
    const maxMotion = role === "climax" ? 3
      : role === "hook-signature" || role === "answer" || role === "approach" ? 2
        : role === "resolution" ? 2
          : 1;
    result = clamp(result, previous - maxMotion, previous + maxMotion);
  }

  return Object.freeze({
    version: MELODY_INTENT_VERSION,
    role,
    baseDegree: base,
    proposedDegree: proposed,
    degree: result,
    budget,
    constrained: result !== proposed,
  });
}

export function shouldAllowOrnamentalTurn({
  genre,
  surprise = 0,
  eventIndex = 0,
  eventCount = 1,
  role = "continuation",
} = {}) {
  const protectedGenre = ["hipHop", "rap", "trap", "pop"].includes(String(genre ?? ""));
  if (!protectedGenre) return true;
  if (finite(surprise, 0) < 0.72) return false;
  if (!["hook-signature", "climax", "answer"].includes(role)) return false;
  const interior = eventIndex > 0 && eventIndex < Math.max(1, eventCount - 1);
  if (!interior) return false;
  // At most one deliberate ornamental slot per phrase; never scattered turns.
  return eventIndex === Math.floor(eventCount * 0.62);
}

export function hookSignatureAdjustment({
  sectionName,
  role,
  eventIndex = 0,
  eventCount = 1,
  repeat = 0,
} = {}) {
  const name = normalizedName(sectionName);
  if (!["chorus", "drop", "theme"].includes(name) || role !== "hook-signature") {
    return Object.freeze({ degreeShift: 0, durationScale: 1, velocityScale: 1 });
  }

  const signatureIndex = Math.max(1, Math.min(eventCount - 2, Math.floor(eventCount * 0.58)));
  if (eventIndex !== signatureIndex) {
    return Object.freeze({ degreeShift: 0, durationScale: 1, velocityScale: 1 });
  }

  // Repeat the same recognizable hook gesture instead of inventing a new local variation.
  return Object.freeze({
    degreeShift: repeat % 2 === 0 ? 1 : 0,
    durationScale: 1.12,
    velocityScale: 1.08,
  });
}

export { MELODY_INTENT_VERSION };
