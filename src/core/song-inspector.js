import { rankShapeSuggestions, SHAPE_QUICK_DIRECTIONS } from "./shape-director-policy.js";
import { evaluateChorusHookRecurrence } from "./chorus-hook-recurrence.js";

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

/**
 * A read-only, section-specific musical observation. Hook recurrence is
 * calculated from final melody notes; this never rewrites the composition or
 * bypasses Shape's existing Preview / Accept boundary.
 *
 * Only the selected returning chorus can receive this suggestion. Do not
 * interpret a first chorus, an absent melody, or too few notes as a failure.
 */
function chorusHookInsight(song, section) {
  const selectedId = section?.id == null ? "" : String(section.id);
  if (!selectedId || !Array.isArray(song?.tracks) || !Array.isArray(song?.structure ?? song?.sections)) {
    return null;
  }
  const report = evaluateChorusHookRecurrence(song);
  const comparison = report.comparisons.find((entry) =>
    entry.available && String(entry.sectionId) === selectedId
      && Number.isFinite(entry.score) && entry.score < 0.66);
  if (!comparison) return null;

  const similarity = Math.round(comparison.score * 100);
  const shared = comparison.sharedAttacks;
  const returning = comparison.returningNotes;
  return Object.freeze({
    directionId: "catchier",
    title: "Reconnect this chorus to the main hook",
    action: `Preview ${SHAPE_QUICK_DIRECTIONS.catchier.label}`,
    explanation: `The returning chorus has ${similarity}% opening-hook similarity to the first chorus and ${shared} shared note attacks out of ${returning}. Preview a Catchier change before saving it.`,
    evidence: "CHORUS HOOK RETURN",
  });
}

export function songInspectorSuggestions({ song = {}, section = {}, target = "track", trackId = null, elementId = null, limit = 2 } = {}) {
  const ranked = rankShapeSuggestions({ song, section, target, elementId, limit: 3 });
  const displayLimit = Math.max(0, Math.min(3, Number(limit) || 0));
  // A melody-hook action cannot repair a drum, bass, chord or pad-only edit.
  // Require a whole-section scope or an explicitly selected melody lane.
  const melodyScope = target === "section" || (trackId === "melody" && (target === "track" || target === "notes"));
  const hook = displayLimit && melodyScope ? chorusHookInsight(song, section) : null;
  const suggestions = ranked
    .filter((entry) => entry.signals.some((signal) => signal !== "fallback"))
    .slice(0, displayLimit)
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
    }));
  // A concrete weak return is more actionable than general section/style
  // advice. Keep other ranked ideas in their existing order without duplicates.
  return Object.freeze((hook
    ? [hook, ...suggestions.filter((entry) => entry.directionId !== "catchier")]
    : suggestions).slice(0, displayLimit));
}
