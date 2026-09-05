function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function wrapDegree(value) {
  return ((Math.round(finite(value)) % 7) + 7) % 7;
}

/**
 * Shapes the last three harmonic events as preparation -> approach -> goal.
 * Degrees stay scale-relative, so the engine's scale-safety contract remains intact.
 */
export function cadentialHarmonyDegree({
  cadence = "open",
  currentDegree = 0,
  approachDegree = 4,
  harmonicGoalDegree,
  localBar = 0,
  sectionBars = 1,
  flavor = 0,
  finalSongBar = false,
} = {}) {
  const distanceFromEnd = Math.max(0, Math.round(sectionBars) - 1 - Math.round(localBar));
  if (finalSongBar) return 0;
  if (distanceFromEnd === 0) {
    if (cadence === "resolve") return 0;
    if (cadence === "lift") return 4;
    if (["suspend", "open"].includes(cadence) && Number.isFinite(Number(harmonicGoalDegree))) {
      return wrapDegree(harmonicGoalDegree);
    }
    return wrapDegree(currentDegree);
  }
  if (!["resolve", "lift"].includes(cadence)) return wrapDegree(currentDegree);
  const approach = wrapDegree(approachDegree);
  if (distanceFromEnd === 1) return approach;
  if (distanceFromEnd !== 2 || sectionBars < 4) return wrapDegree(currentDegree);
  const preparations = approach === 4 ? [1, 3]
    : approach === 1 ? [3, 5]
      : approach === 6 ? [2, 3]
        : [3, 1];
  return preparations[Math.abs(Math.round(finite(flavor))) % preparations.length];
}

export function phraseLandingRole({
  boundaryIndex = 0,
  boundaryCount = 1,
  cadence = "open",
  trackId = "melody",
} = {}) {
  const finalBoundary = boundaryIndex >= Math.max(0, boundaryCount - 1);
  if (finalBoundary && cadence === "resolve") return "resolution";
  if (finalBoundary && cadence === "lift") return "lift";
  if (finalBoundary && cadence === "suspend") return "suspension";
  const question = boundaryIndex % 2 === 0;
  if (trackId === "counterpoint") return question ? "response" : "question";
  return question ? "question" : "answer";
}

export function phraseLandingProfile(role = "answer") {
  const profiles = {
    question: { direction: 1, avoidRoot: true, durationScale: 0.76, velocityDelta: -2, articulation: "light" },
    response: { direction: -1, avoidRoot: false, durationScale: 0.86, velocityDelta: -1, articulation: "connected" },
    answer: { direction: -1, avoidRoot: false, durationScale: 1.08, velocityDelta: 2, articulation: "tenuto" },
    lift: { direction: 1, avoidRoot: false, durationScale: 1.05, velocityDelta: 4, articulation: "tenuto" },
    suspension: { direction: 0, avoidRoot: true, durationScale: 1.15, velocityDelta: 2, articulation: "tenuto" },
    resolution: { direction: -1, avoidRoot: false, durationScale: 1.24, velocityDelta: 6, articulation: "tenuto" },
  };
  return Object.freeze(profiles[role] ?? profiles.answer);
}
