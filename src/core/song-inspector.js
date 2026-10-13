import { rankShapeSuggestions, SHAPE_QUICK_DIRECTIONS } from "./shape-director-policy.js";

// Read-only guidance derived from Shape's existing, deterministic policy.
// No new score, inference model, or song mutation is introduced here.
const HEADLINES = Object.freeze({
  catchier: "Give the hook a clearer identity",
  moreBounce: "Strengthen the rhythm pocket",
  moreSpace: "Make room for the lead idea",
  buildUp: "Develop a stronger musical buildup",
  moreEmotional: "Bring out harmonic contrast",
  harder: "Add impact to this section",
  simpler: "Reduce competing musical activity",
  busier: "Introduce controlled movement",
  calmDown: "Let this section settle",
  darker: "Explore a darker color",
  brighter: "Lift the melodic register",
});

export function songInspectorSuggestions({ song = {}, section = {}, target = "track", elementId = null, limit = 2 } = {}) {
  const ranked = rankShapeSuggestions({ song, section, target, elementId, limit: 3 });
  return Object.freeze(ranked
    .filter((entry) => entry.signals.some((signal) => signal !== "fallback"))
    .slice(0, Math.max(0, Math.min(3, Number(limit) || 0)))
    .map((entry) => Object.freeze({
      directionId: entry.directionId,
      title: HEADLINES[entry.directionId] ?? SHAPE_QUICK_DIRECTIONS[entry.directionId].label,
      action: `Preview ${SHAPE_QUICK_DIRECTIONS[entry.directionId].label}`,
      explanation: entry.reason,
      evidence: entry.signals.includes("critic")
        ? "LOWEST SCORED DIMENSION"
        : entry.signals.includes("section")
          ? "SECTION ROLE"
          : entry.signals.includes("element")
            ? "CREATIVE PERSONALITY"
            : "SELECTED SCOPE",
    })));
}
