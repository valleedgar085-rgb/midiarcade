const REROUTE_MODES = Object.freeze(new Set([
  "harmony-first",
  "groove-first",
  "hook-first",
]));


const DIMENSION_OWNERS = Object.freeze({
  groove: "groove",
  density: "groove",
  drumVariety: "groove",
  harmonic: "harmony",
  voiceLeading: "harmony",
  cadence: "harmony",
  harmonicJourney: "harmony",
  registerHealth: "register",
  motif: "phrase",
  repetition: "phrase",
  memory: "phrase",
  phraseResolution: "phrase",
  separation: "ensemble",
  performance: "ensemble",
  orchestration: "ensemble",
  production: "ensemble",
  storyArc: "ensemble",
  transitions: "ensemble",
  tensionFollow: "ensemble",
  stageInterlock: "ensemble",
  sectionContrast: "ensemble",
  identitySimilarity: "ensemble",
});

const SPECIALISTS = Object.freeze({
  groove: "groove-specialist",
  register: "register-specialist",
  harmony: "harmony-specialist",
  phrase: "phrase-specialist",
  ensemble: "ensemble-specialist",
});

const QUALITY_STAGE_OWNERS = Object.freeze({
  arrangement: ["ensemble", "phrase"],
  returnDevelopment: ["ensemble", "phrase"],
  groovePocket: ["groove"],
  densityRefinement: ["groove", "ensemble"],
  phraseResolutionRefinement: ["phrase", "harmony"],
  repetitionRefinement: ["phrase"],
  registerHealthRefinement: ["register"],
  fusionPerformanceRefinement: ["ensemble", "groove"],
  melodyContinuityRefinement: ["phrase", "ensemble", "harmony"],
  bassContinuityRefinement: ["groove", "ensemble", "harmony"],
  ensembleContinuityRefinement: ["ensemble"],
  genreIdentityRefinement: ["groove", "ensemble"],
  transitionFxRefinement: [],
});

const OWNER_MUTATIONS = Object.freeze({
  groove: ["topology", "timing", "duration"],
  register: ["register"],
  harmony: ["harmony"],
  phrase: ["topology", "timing", "duration", "harmony"],
  ensemble: ["topology", "timing"],
});

export function resolveWeaknessAuthority(diagnosis = {}) {
  const dimension = String(diagnosis?.weakestDimension ?? diagnosis?.focusDimension ?? "");
  const group = String(diagnosis?.group ?? diagnosis?.focusGroup ?? "");
  const owner = DIMENSION_OWNERS[dimension]
    ?? (["harmony", "groove", "motif", "performance", "arrangement"].includes(group)
      ? ({ harmony: "harmony", groove: "groove", motif: "phrase", performance: "ensemble", arrangement: "ensemble" })[group]
      : null);
  return Object.freeze({
    version: 1,
    owner,
    specialist: owner ? SPECIALISTS[owner] : null,
    dimension: dimension || null,
    group: group || null,
    mutations: Object.freeze([...(OWNER_MUTATIONS[owner] ?? [])]),
  });
}

export function qualityStageAuthority(stageId) {
  const owners = Object.freeze([...(QUALITY_STAGE_OWNERS[String(stageId)] ?? [])]);
  const mutations = Object.freeze([...new Set(owners.flatMap((owner) => OWNER_MUTATIONS[owner] ?? []))]);
  return Object.freeze({
    version: 1,
    stageId: String(stageId ?? ""),
    owners,
    mutations,
    automationOnly: String(stageId) === "transitionFxRefinement",
  });
}

function normalizeKind(kind) {
  return String(kind ?? "");
}

export function decideGenerationRepairAuthority(kind, diagnosis = {}, config = {}) {
  const requestKind = normalizeKind(kind);
  const focusRoute = REROUTE_MODES.has(String(diagnosis?.focusRoute))
    ? String(diagnosis.focusRoute)
    : null;
  const explicitRoute = config?.compositionRoute != null && String(config.compositionRoute).length > 0;
  const specialistAuthority = resolveWeaknessAuthority(diagnosis);
  const reroute = Boolean(
    diagnosis?.shouldRetry
    && focusRoute
    && !explicitRoute
    && (requestKind === "new" || requestKind === "similar")
  );

  if (reroute) {
    return Object.freeze({
      version: 1,
      owner: "generation-repair-router",
      mode: "composition-reroute",
      phase: "compose",
      focusRoute,
      focusDimension: diagnosis?.focusDimension ?? null,
      focusGroup: diagnosis?.focusGroup ?? null,
      reason: diagnosis?.reason ?? "critic-focus-retry",
      specialist: specialistAuthority.specialist,
      mutationOwner: specialistAuthority.owner,
      allowedMutations: specialistAuthority.mutations,
      allowsFullRegeneration: true,
      allowsSurgicalPostprocess: true,
    });
  }

  return Object.freeze({
    version: 1,
    owner: "generation-repair-router",
    mode: "surgical-postprocess",
    phase: "post-compose",
    focusRoute,
    focusDimension: diagnosis?.focusDimension ?? null,
    focusGroup: diagnosis?.focusGroup ?? null,
    reason: diagnosis?.reason ?? "postprocess-authority",
    specialist: specialistAuthority.specialist,
    mutationOwner: specialistAuthority.owner,
    allowedMutations: specialistAuthority.mutations,
    allowsFullRegeneration: false,
    allowsSurgicalPostprocess: true,
  });
}


export function authorizeQualityStage(stageId, repairAuthority = null) {
  const stage = qualityStageAuthority(stageId);
  if (!repairAuthority) {
    return Object.freeze({ allowed: true, reason: "no-router-context", stage });
  }
  if (repairAuthority.allowsSurgicalPostprocess !== true) {
    return Object.freeze({ allowed: false, reason: "surgical-postprocess-disabled", stage });
  }
  if (stage.automationOnly) {
    return Object.freeze({ allowed: true, reason: "automation-only", stage });
  }
  const owner = repairAuthority.mutationOwner ?? null;
  if (!owner) {
    return Object.freeze({ allowed: true, reason: "general-postprocess-authority", stage });
  }
  const allowed = stage.owners.includes(owner);
  return Object.freeze({
    allowed,
    reason: allowed ? "specialist-owner-match" : "specialist-owner-mismatch",
    stage,
    requestedOwner: owner,
  });
}

export function attachGenerationRepairAuthority(config = {}, authority = null) {
  if (!authority) return { ...config };
  return {
    ...config,
    generationRepairAuthority: authority,
  };
}
