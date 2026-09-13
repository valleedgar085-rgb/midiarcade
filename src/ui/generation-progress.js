import "./create-workflow-phase1.js";
import "./element-button-v3.js";

const DEFAULT_STAGES = Object.freeze([
  Object.freeze({ id: "blueprint", label: "Song map", copy: "Planning section energy, contrast, and the return of the hook." }),
  Object.freeze({ id: "harmony", label: "Harmony", copy: "Testing chord colors, voice leading, and cadential direction." }),
  Object.freeze({ id: "phrases", label: "Phrases", copy: "Writing a lead statement, answers, breaths, and memorable returns." }),
  Object.freeze({ id: "groove", label: "Pocket", copy: "Locking drums and bass while protecting melodic space." }),
  Object.freeze({ id: "audition", label: "Producer", copy: "Auditioning complete candidates and repairing the weakest dimension." }),
  Object.freeze({ id: "master", label: "Final pass", copy: "Balancing the featured instrument and checking every musical handoff." }),
]);

const SIMILAR_OVERRIDES = Object.freeze({
  blueprint: "Preserving the song's identity while choosing a different journey.",
  phrases: "Developing the familiar motif without copying the previous performance.",
});

const VARIATION_OVERRIDES = Object.freeze({
  blueprint: "Mapping three distinct arrangements around the same musical identity.",
  audition: "Comparing six complete candidates for hook, pocket, and story arc.",
});

const STAGE_CADENCE_MS = Object.freeze({
  new: 560,
  similar: 520,
  songVariations: 680,
  sectionVariations: 500,
});

const MINIMUM_VISIBLE_MS = Object.freeze({
  new: 3200,
  similar: 3000,
  songVariations: 4200,
  sectionVariations: 2800,
});

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

export function generationStages(kind = "new") {
  const overrides = kind === "similar"
    ? SIMILAR_OVERRIDES
    : kind === "songVariations"
      ? VARIATION_OVERRIDES
      : {};
  return DEFAULT_STAGES.map((stage) => Object.freeze({
    ...stage,
    copy: overrides[stage.id] ?? stage.copy,
  }));
}

export function generationStageCadenceMs(kind = "new") {
  return STAGE_CADENCE_MS[kind] ?? STAGE_CADENCE_MS.new;
}

export function generationMinimumVisibleMs(kind = "new") {
  return MINIMUM_VISIBLE_MS[kind] ?? MINIMUM_VISIBLE_MS.new;
}

/**
 * A deliberately steady visual timeline. Generation can complete quickly, but
 * the progress UI should never flash through six stages in a few frames. The
 * meter advances continuously while labels change at a human-readable cadence;
 * 100% is reserved for the completion/fade state controlled by the overlay.
 */
export function generationStageState(kind = "new", elapsedMs = 0) {
  const stages = generationStages(kind);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const cadenceMs = generationStageCadenceMs(kind);
  const stageIndex = Math.min(stages.length - 1, Math.floor(elapsed / cadenceMs));
  const timelineMs = Math.max(1, cadenceMs * stages.length);
  const timelineRatio = clamp01(elapsed / timelineMs);
  const progress = Math.min(0.96, 0.05 + timelineRatio * 0.91);

  return Object.freeze({
    stage: stages[stageIndex],
    stageIndex,
    stageNumber: stageIndex + 1,
    stageCount: stages.length,
    cadenceMs,
    progress,
  });
}
