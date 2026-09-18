export const SHAPE_CHANGE_SIZES = Object.freeze({
  touchUp: Object.freeze({
    id: "touchUp",
    label: "Touch Up",
    description: "Small musical adjustments that preserve the phrase and arrangement identity.",
    rewriteBudget: 0.18,
  }),
  reshape: Object.freeze({
    id: "reshape",
    label: "Reshape",
    description: "Meaningful section changes that keep the song recognizable.",
    rewriteBudget: 0.46,
  }),
  transform: Object.freeze({
    id: "transform",
    label: "Transform",
    description: "Large local rewrites that preserve the selected locks and the surrounding song context.",
    rewriteBudget: 0.78,
  }),
});

export const SHAPE_TARGETS = Object.freeze(["section", "track", "notes"]);

export const SHAPE_PRESERVE_LOCKS = Object.freeze([
  "melody",
  "harmony",
  "rhythm",
  "instrument",
]);

export const SHAPE_QUICK_DIRECTIONS = Object.freeze({
  moreBounce: Object.freeze({ id: "moreBounce", label: "More Bounce", dimensions: ["groove", "syncopation", "velocityContour"] }),
  harder: Object.freeze({ id: "harder", label: "Harder", dimensions: ["density", "velocityContour", "register"] }),
  simpler: Object.freeze({ id: "simpler", label: "Simpler", dimensions: ["density", "repetition", "phraseLength"] }),
  busier: Object.freeze({ id: "busier", label: "Busier", dimensions: ["density", "variation", "syncopation"] }),
  moreEmotional: Object.freeze({ id: "moreEmotional", label: "More Emotional", dimensions: ["harmonyMotion", "phraseResolution", "register"] }),
  moreSpace: Object.freeze({ id: "moreSpace", label: "More Space", dimensions: ["density", "phraseLength", "noteGate"] }),
  catchier: Object.freeze({ id: "catchier", label: "Catchier", dimensions: ["motif", "repetition", "phraseResolution"] }),
  darker: Object.freeze({ id: "darker", label: "Darker", dimensions: ["register", "harmonicTension", "density"] }),
  brighter: Object.freeze({ id: "brighter", label: "Brighter", dimensions: ["register", "chordColor", "melodicLift"] }),
  buildUp: Object.freeze({ id: "buildUp", label: "Build Up", dimensions: ["energy", "density", "transition"] }),
  calmDown: Object.freeze({ id: "calmDown", label: "Calm Down", dimensions: ["energy", "density", "register"] }),
});

const SHAPE_OWNED_CONTROLS = new Set([
  "energy",
  "density",
  "groove",
  "syncopation",
  "variation",
  "repetition",
  "phraseLength",
  "phraseResolution",
  "noteGate",
  "velocityContour",
  "register",
  "motif",
  "harmonyMotion",
  "harmonicTension",
  "chordColor",
  "melodicLift",
  "transition",
]);

const MIX_OWNED_CONTROLS = new Set([
  "volume",
  "pan",
  "mute",
  "solo",
  "eq",
  "filter",
  "compression",
  "limiting",
  "saturation",
  "reverb",
  "delay",
  "stereoWidth",
  "send",
  "busProcessing",
  "masterLoudness",
  "masterCeiling",
]);

export function controlOwner(controlId) {
  const id = String(controlId ?? "");
  if (SHAPE_OWNED_CONTROLS.has(id)) return "shape";
  if (MIX_OWNED_CONTROLS.has(id)) return "mix";
  return "shared";
}

export function normalizeShapeSelection(input = {}) {
  const target = SHAPE_TARGETS.includes(input.target) ? input.target : "section";
  const sectionId = input.sectionId == null ? null : String(input.sectionId);
  const trackId = input.trackId == null ? null : String(input.trackId);
  const noteIds = Array.isArray(input.noteIds) ? [...new Set(input.noteIds.map(String))] : [];

  if (target === "section" && !sectionId) {
    throw new TypeError("Shape section selection requires sectionId");
  }
  if ((target === "track" || target === "notes") && (!sectionId || !trackId)) {
    throw new TypeError(`${target} Shape selection requires sectionId and trackId`);
  }
  if (target === "notes" && noteIds.length === 0) {
    throw new TypeError("Shape note selection requires at least one noteId");
  }

  return Object.freeze({ target, sectionId, trackId, noteIds: Object.freeze(noteIds) });
}

export function createShapeIntent({
  selection,
  size = "touchUp",
  direction = null,
  preserve = [],
} = {}) {
  const normalizedSelection = normalizeShapeSelection(selection);
  const changeSize = SHAPE_CHANGE_SIZES[size] ?? SHAPE_CHANGE_SIZES.touchUp;
  const quickDirection = direction == null ? null : SHAPE_QUICK_DIRECTIONS[direction];
  if (direction != null && !quickDirection) throw new TypeError(`Unknown Shape direction: ${direction}`);

  const locks = [...new Set((preserve ?? []).filter((id) => SHAPE_PRESERVE_LOCKS.includes(id)))];
  return Object.freeze({
    version: 1,
    selection: normalizedSelection,
    size: changeSize,
    direction: quickDirection ?? null,
    preserve: Object.freeze(locks),
  });
}

const SHAPE_SUGGESTION_ORDER = Object.freeze(Object.keys(SHAPE_QUICK_DIRECTIONS));

const CRITIC_DIRECTION = Object.freeze({
  groove: "moreBounce",
  transitions: "buildUp",
  harmony: "moreEmotional",
  phraseResolution: "catchier",
  hook: "catchier",
  arrangement: "buildUp",
  production: "moreSpace",
  performance: "harder",
});

const ELEMENT_DIRECTIONS = Object.freeze({
  fire: Object.freeze(["harder", "moreBounce", "buildUp"]),
  electric: Object.freeze(["catchier", "busier", "buildUp"]),
  drip: Object.freeze(["moreSpace", "moreEmotional", "darker"]),
});

function sectionSuggestion(section = {}) {
  const label = String(section?.role ?? section?.name ?? section?.id ?? "").toLowerCase();
  if (/intro|opening/.test(label)) return ["moreSpace", "let the opening establish identity without overcrowding it"];
  if (/pre.?chorus|build|riser|lift/.test(label)) return ["buildUp", "shape a clearer rise into the next payoff"];
  if (/chorus|hook|drop|payoff/.test(label)) return ["catchier", "make the payoff easier to recognize and remember"];
  if (/bridge|break|middle/.test(label)) return ["moreEmotional", "create contrast before the song returns"];
  if (/outro|ending|release/.test(label)) return ["calmDown", "let the ending release energy instead of adding another peak"];
  if (/verse/.test(label)) return ["moreBounce", "strengthen pocket while leaving room for later sections to lift"];
  return ["buildUp", "clarify this section's role in the surrounding song arc"];
}

function criticWeakness(song = {}) {
  const subscores = song?.meta?.scoreDetails?.subscores;
  if (!subscores || typeof subscores !== "object") return null;
  return Object.entries(subscores)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] ?? null;
}

function normalizedElementId(song, explicit) {
  return String(
    explicit
      ?? song?.variationSet?.element?.id
      ?? song?.element?.id
      ?? song?.elementId
      ?? "",
  ).trim().toLowerCase();
}

export function rankShapeSuggestions({
  song = {},
  section = {},
  target = "section",
  elementId = null,
  limit = 3,
} = {}) {
  const ranked = new Map();
  const add = (id, weight, reason, signal) => {
    if (!SHAPE_QUICK_DIRECTIONS[id]) return;
    const current = ranked.get(id) ?? { id, score: 0, reasons: [], signals: [] };
    current.score += weight;
    if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
    if (signal && !current.signals.includes(signal)) current.signals.push(signal);
    ranked.set(id, current);
  };

  const weakness = criticWeakness(song);
  const criticDirection = CRITIC_DIRECTION[weakness];
  if (criticDirection) {
    add(
      criticDirection,
      6,
      `the critic's weakest current dimension is ${String(weakness).replace(/([a-z])([A-Z])/g, "$1 $2")}`,
      "critic",
    );
  }

  const [sectionDirection, sectionReason] = sectionSuggestion(section);
  add(sectionDirection, 5, sectionReason, "section");

  const element = normalizedElementId(song, elementId);
  for (const [index, id] of (ELEMENT_DIRECTIONS[element] ?? []).entries()) {
    add(id, 4 - index, `${element} identity favors this kind of local change`, "element");
  }

  const targetDirection = target === "notes"
    ? "catchier"
    : target === "track"
      ? "moreBounce"
      : "buildUp";
  add(
    targetDirection,
    2,
    target === "notes"
      ? "selected-note scope benefits from a clear motif-level intention"
      : target === "track"
        ? "instrument scope benefits from a focused performance/pocket move"
        : "whole-section scope can carry an arrangement-level energy decision",
    "target",
  );

  for (const [index, id] of ["moreBounce", "catchier", "moreSpace"].entries()) {
    add(id, 0.5 - index * 0.05, "safe starting point when no stronger signal wins", "fallback");
  }

  return Object.freeze(
    [...ranked.values()]
      .sort((a, b) => (
        b.score - a.score
        || SHAPE_SUGGESTION_ORDER.indexOf(a.id) - SHAPE_SUGGESTION_ORDER.indexOf(b.id)
      ))
      .slice(0, Math.max(1, Number(limit) || 3))
      .map((entry, index) => Object.freeze({
        rank: index + 1,
        directionId: entry.id,
        direction: SHAPE_QUICK_DIRECTIONS[entry.id],
        score: entry.score,
        reason: entry.reasons.slice(0, 2).join("; "),
        signals: Object.freeze([...entry.signals]),
      })),
  );
}

