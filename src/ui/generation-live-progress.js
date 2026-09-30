import { generationStages } from "./generation-progress.js";

const LIVE_PHASES = Object.freeze({ plan: 0, compose: 1, diagnose: 2, repair: 3, compare: 4, finalize: 5, persist: 5, complete: 5 });
const LIVE_STAGES = Object.freeze([
  { label: "Planning", copy: "Reading your song direction and selected instruments." },
  { label: "Composing", copy: "Building song candidates: sections, chords, drums, bass, and melody. Planning notes toward upcoming chords." },
  { label: "Checking", copy: "Checking the generated music for harmony, groove, phrasing, and balance." },
  { label: "Improving", copy: "Trying another composition to improve the weakest musical area." },
  { label: "Comparing", copy: "Comparing candidates and choosing the stronger result." },
  { label: "Final checks", copy: "Applying final refinements and rechecking the resulting music." },
]);

export function generationLiveStageState(kind = "new", elapsedMs = 0, report) {
  const stages = generationStages(kind);
  const stageIndex = LIVE_PHASES[report?.phase] ?? 0;
  const progress = report?.phase === "complete" ? 1 : [0.05, 0.16, 0.5, 0.6, 0.76, 0.9][stageIndex];
  const detail = report?.detail?.focusDimension;
  const focus = typeof detail === "string" ? detail.replace(/([A-Z])/g, " $1").toLowerCase() : "";
  const stage = { ...stages[stageIndex], ...LIVE_STAGES[stageIndex] };
  if (report?.phase === "repair" && focus) stage.copy += ` Focus: ${focus}.`;
  if (report?.phase === "persist") { stage.label = "Saving"; stage.copy = "Saving the accepted song on your device."; }
  if (report?.phase === "complete") { stage.label = "Ready"; stage.copy = "Composition finished. Preparing your song for playback."; }
  const completedStageIds = (report?.visited ?? []).filter(phase => phase !== report?.phase).map(phase => stages[LIVE_PHASES[phase] ?? 0].id);

  return Object.freeze({
    stage: Object.freeze(stage),
    completedStageIds,
    stageIndex,
    stageNumber: stageIndex + 1,
    stageCount: stages.length,
    progress,
  });
}
