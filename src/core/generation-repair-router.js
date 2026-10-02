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

const READ_ONLY_QUALITY_STAGES = Object.freeze(new Set([
  "melodySectionMemoryAudit",
]));

const STRICT_MUTATION_QUALITY_STAGES = Object.freeze(new Set([
  "melodySectionDevelopmentRefinement",
]));

const QUALITY_STAGE_MUTATIONS = Object.freeze({
  melodySectionDevelopmentRefinement: Object.freeze(["duration", "harmony"]),
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
  melodyPhraseRefinement: ["phrase", "harmony", "ensemble"],
  melodySectionDevelopmentRefinement: ["phrase", "harmony", "ensemble"],
  melodySectionMemoryAudit: [],
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

const ENSEMBLE_RELATIONSHIP_MUTATIONS = Object.freeze({
  "kick-bass": Object.freeze(["timing", "duration"]),
  "bass-harmony": Object.freeze(["timing", "topology"]),
  "chord-melody": Object.freeze(["timing", "topology"]),
  "melody-counterline": Object.freeze(["timing", "topology"]),
  "density-balance": Object.freeze(["topology"]),
  "entrance-exit": Object.freeze(["topology", "timing"]),
  "transition-continuity": Object.freeze(["topology", "timing"]),
  "payoff-lift": Object.freeze(["topology", "timing"]),
});

const ENSEMBLE_REPAIR_ACTIONS = Object.freeze({
  "kick-bass": "relock-foundation-without-cloning",
  "bass-harmony": "make-support-yield-to-foundation",
  "chord-melody": "clear-foreground-register-and-onsets",
  "melody-counterline": "restore-call-response-turn-taking",
  "density-balance": "subtract-support-before-adding-notes",
  "entrance-exit": "stagger-role-entrances-and-exits",
  "transition-continuity": "preserve-one-or-more-carrying-roles",
  "payoff-lift": "increase-contrast-before-note-count",
});

function createEnsembleRepairDirective(sectionId, relationship, extra = {}) {
  const normalized = String(relationship ?? "");
  return Object.freeze({
    sectionId: sectionId ?? null,
    relationship: normalized || null,
    allowedMutations: Object.freeze([
      ...(ENSEMBLE_RELATIONSHIP_MUTATIONS[normalized] ?? OWNER_MUTATIONS.ensemble),
    ]),
    preferredAction: ENSEMBLE_REPAIR_ACTIONS[normalized] ?? "target-smallest-ensemble-conflict",
    policy: "bounded-subtractive-first",
    ...extra,
  });
}

/**
 * Build a bounded repair plan from the committed final ensemble audit.
 *
 * This function does not mutate notes and never authorizes a full-song
 * regeneration. It returns at most two targeted directives by default.
 */
export function resolveFinalEnsembleRepairPlan(report = null, { maxDirectives = 2 } = {}) {
  const limit = Math.max(1, Math.min(4, Number(maxDirectives) || 2));
  const candidates = [];

  for (const failure of report?.sectionFailures ?? []) {
    for (const relationship of failure?.failures ?? []) {
      candidates.push(createEnsembleRepairDirective(failure?.sectionId, relationship, {
        source: "micro-ensemble-pass",
      }));
    }
  }

  for (const pair of report?.macroDiagnostics?.payoffPairs ?? []) {
    if (pair?.healthy === false) {
      candidates.push(createEnsembleRepairDirective(pair?.toSectionId, "payoff-lift", {
        source: "macro-song-pass",
        fromSectionId: pair?.fromSectionId ?? null,
      }));
    }
  }

  for (const transition of report?.macroDiagnostics?.transitions ?? []) {
    if (transition?.hardReset === true) {
      candidates.push(createEnsembleRepairDirective(transition?.toSectionId, "transition-continuity", {
        source: "macro-song-pass",
        fromSectionId: transition?.fromSectionId ?? null,
      }));
    } else if (transition?.staged === false) {
      candidates.push(createEnsembleRepairDirective(transition?.toSectionId, "entrance-exit", {
        source: "macro-song-pass",
        fromSectionId: transition?.fromSectionId ?? null,
      }));
    }
  }

  const seen = new Set();
  const directives = [];
  for (const candidate of candidates) {
    const key = [candidate.sectionId, candidate.relationship, candidate.fromSectionId ?? ""].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    directives.push(candidate);
    if (directives.length >= limit) break;
  }

  return Object.freeze({
    version: 2,
    authority: "final-ensemble-repair-plan-v2",
    available: directives.length > 0,
    owner: directives.length ? "ensemble" : null,
    specialist: directives.length ? SPECIALISTS.ensemble : null,
    directives: Object.freeze(directives),
    allowsFullRegeneration: false,
    allowsSurgicalPostprocess: directives.length > 0,
    policy: "bounded-subtractive-first",
    reason: directives.length
      ? "committed-final-ensemble-needs-targeted-repair"
      : "committed-final-ensemble-coherent",
  });
}

export function resolveEnsembleCoherenceRepairHint(report = null) {
  const plan = resolveFinalEnsembleRepairPlan(report, { maxDirectives: 1 });
  const first = plan.directives[0] ?? null;
  return Object.freeze({
    version: 2,
    available: Boolean(first),
    owner: first ? "ensemble" : null,
    specialist: first ? SPECIALISTS.ensemble : null,
    sectionId: first?.sectionId ?? null,
    relationship: first?.relationship ?? null,
    allowedMutations: first?.allowedMutations ?? Object.freeze([]),
    preferredAction: first?.preferredAction ?? null,
    reason: first ? plan.reason : "no-section-coherence-failure",
  });
}

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
  const normalizedStageId = String(stageId ?? "");
  const readOnly = READ_ONLY_QUALITY_STAGES.has(normalizedStageId);
  const owners = Object.freeze([...(QUALITY_STAGE_OWNERS[normalizedStageId] ?? [])]);
  const stageMutations = QUALITY_STAGE_MUTATIONS[normalizedStageId];
  const mutations = Object.freeze(readOnly
    ? []
    : stageMutations
      ? [...stageMutations]
      : [...new Set(owners.flatMap((owner) => OWNER_MUTATIONS[owner] ?? []))]);
  return Object.freeze({
    version: 1,
    stageId: normalizedStageId,
    owners,
    mutations,
    readOnly,
    strictMutations: STRICT_MUTATION_QUALITY_STAGES.has(normalizedStageId),
    automationOnly: normalizedStageId === "transitionFxRefinement",
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
  if (stage.readOnly) {
    return Object.freeze({ allowed: true, reason: "read-only-audit", stage });
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
