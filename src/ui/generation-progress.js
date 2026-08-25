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

export function generationStageState(kind = "new", elapsedMs = 0) {
  const stages = generationStages(kind);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const stageIndex = Math.min(stages.length - 1, Math.floor(elapsed / 820));
  return Object.freeze({
    stage: stages[stageIndex],
    stageIndex,
    stageNumber: stageIndex + 1,
    stageCount: stages.length,
    progress: (stageIndex + 1) / stages.length,
  });
}
