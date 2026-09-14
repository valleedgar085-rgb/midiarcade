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
