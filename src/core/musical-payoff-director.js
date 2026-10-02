function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function normalizeName(section) {
  return String(section?.name ?? section?.type ?? section?.id ?? "")
    .trim()
    .toLowerCase();
}

function legacyPhase(section, index, total) {
  const name = normalizeName(section);
  if (/(intro|opening)/.test(name) || index === 0) return "opening";
  if (/(pre|build|riser|build-up|buildup)/.test(name)) return "build";
  if (/(chorus|drop|hook|refrain|payoff|theme)/.test(name)) return "payoff";
  if (/(breakdown|break|bridge|interlude|reset|solo)/.test(name)) return "recovery";
  if (/(outro|ending|end)/.test(name) || index === total - 1) return "release";
  return "body";
}

const STAGE_TO_PHASE = Object.freeze({
  establish: "opening",
  pocket: "body",
  develop: "body",
  build: "build",
  payoff: "payoff",
  reset: "recovery",
  resolve: "release",
});

const PHASE_ROLE = Object.freeze({
  opening: "establish",
  body: "develop",
  build: "withhold-and-rise",
  payoff: "deliver",
  recovery: "breathe",
  release: "resolve",
});

function mapBySectionId(entries = []) {
  return new Map(
    (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry?.sectionId != null)
      .map((entry) => [String(entry.sectionId), entry]),
  );
}

function fallbackSpace(phase) {
  if (phase === "opening") return 0.3;
  if (phase === "recovery") return 0.34;
  if (phase === "release") return 0.28;
  if (phase === "payoff") return 0.07;
  if (phase === "build") return 0.11;
  return 0.13;
}

function fallbackTension(phase, energy) {
  if (phase === "build") return clamp(0.58 + energy * 0.28);
  if (phase === "payoff") return clamp(0.5 + energy * 0.18);
  if (phase === "recovery") return clamp(0.24 + energy * 0.12);
  if (phase === "release") return clamp(0.16 + energy * 0.1);
  if (phase === "opening") return clamp(0.2 + energy * 0.16);
  return clamp(0.36 + energy * 0.16);
}

function authorityIntentForSection(song, section, index, total, maps) {
  const id = String(section?.id ?? "");
  const directorStage = maps.director.get(id) ?? null;
  const sectionPlan = maps.plans.get(id) ?? null;
  const scene = maps.scenes.get(id) ?? null;

  const stage = String(
    directorStage?.stage
      ?? sectionPlan?.structureStory?.stage
      ?? scene?.storyStage
      ?? "",
  );
  const phase = STAGE_TO_PHASE[stage] ?? legacyPhase(section, index, total);
  const targetEnergy = clamp(finite(
    directorStage?.energyTarget
      ?? sectionPlan?.structureStory?.energyTarget
      ?? scene?.energyTarget
      ?? sectionPlan?.energy
      ?? section?.intensity,
    phase === "payoff" ? 0.88
      : phase === "build" ? 0.76
        : phase === "opening" ? 0.44
          : phase === "recovery" ? 0.48
            : phase === "release" ? 0.36
              : 0.62,
  ));
  const targetTension = clamp(finite(
    sectionPlan?.tension
      ?? sectionPlan?.tensionEnvelope?.peak,
    fallbackTension(phase, targetEnergy),
  ));
  const targetSpace = clamp(finite(scene?.silenceBudget, fallbackSpace(phase)));
  const densityCeiling = clamp(finite(scene?.densityCeiling, 1));
  const payoffBreathBars = Math.max(0, finite(
    directorStage?.payoffBreathBars
      ?? sectionPlan?.structureStory?.payoffBreathBars
      ?? scene?.payoffBreathBars,
    0,
  ));

  return Object.freeze({
    sectionId: section?.id ?? null,
    name: section?.name ?? section?.type ?? section?.id ?? null,
    sourceAuthority: directorStage || sectionPlan?.structureStory || scene?.storyStage
      ? "structure-director-v2"
      : "legacy-section-fallback",
    stage: stage || null,
    phase,
    role: PHASE_ROLE[phase] ?? "develop",
    targetEnergy: round(targetEnergy),
    targetTension: round(targetTension),
    targetSpace: round(targetSpace),
    densityCeiling: round(densityCeiling),
    payoffBreathBars: round(payoffBreathBars),
    payoff: phase === "payoff",
    mustBreathe: ["opening", "recovery", "release"].includes(phase),
    mustLiftFromPrevious: phase === "build" || phase === "payoff",
  });
}

function sectionBounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { startBeat, endBeat, length: endBeat - startBeat };
}

function observedSectionPressure(song, section) {
  const bounds = sectionBounds(song, section);
  const tracks = (song?.tracks ?? []).filter((track) => String(track?.id ?? "") !== "fx");
  const local = tracks.map((track) => ({
    id: String(track?.id ?? ""),
    notes: (track?.notes ?? []).filter((note) => {
      const start = finite(note?.start, -1);
      return start >= bounds.startBeat - 1e-6 && start < bounds.endBeat - 1e-6;
    }),
  }));
  const notes = local.flatMap((entry) => entry.notes);
  const activeRoles = local.filter((entry) => entry.notes.length > 0).length;
  const notesPerBeat = notes.length / Math.max(0.25, bounds.length);
  const meanVelocity = notes.length
    ? notes.reduce((sum, note) => sum + finite(note?.velocity, 84), 0) / notes.length
    : 0;
  const foregroundNotes = local
    .filter((entry) => ["melody", "lead", "counterpoint"].includes(entry.id))
    .flatMap((entry) => entry.notes);
  const foregroundShare = notes.length ? foregroundNotes.length / notes.length : 0;
  return Object.freeze({
    pressure: round(clamp(
      clamp(activeRoles / 7) * 0.34
      + clamp(notesPerBeat / 6) * 0.36
      + clamp(meanVelocity / 127) * 0.2
      + clamp(foregroundShare) * 0.1,
    )),
    activeRoles,
    notesPerBeat: round(notesPerBeat),
    meanVelocity: round(meanVelocity, 2),
    foregroundShare: round(foregroundShare),
  });
}

/**
 * Compatibility export: this is now a derived audit contract, not a second
 * composition authority. Structure Director v2 and Producer Intent own the
 * story arc; this module only normalizes those targets for auditing.
 */
export function createMusicalPayoffPlan(song) {
  const sections = Array.isArray(song?.structure) ? song.structure : [];
  const maps = {
    director: mapBySectionId(song?.songBlueprint?.structureDirector?.stages),
    plans: mapBySectionId(song?.songBlueprint?.sectionPlans ?? song?.songBlueprint?.sections),
    scenes: mapBySectionId(song?.producerIntent?.scenes),
  };
  const sectionPlans = sections.map((section, index) => (
    authorityIntentForSection(song, section, index, sections.length, maps)
  ));
  const directorBackedSections = sectionPlans.filter(
    (section) => section.sourceAuthority === "structure-director-v2",
  ).length;

  return Object.freeze({
    version: 2,
    authority: "musical-payoff-audit-v2",
    mode: "derived-read-only-contract",
    sourceAuthority: directorBackedSections === sectionPlans.length && sectionPlans.length
      ? "structure-director-v2"
      : directorBackedSections
        ? "mixed"
        : "legacy-section-fallback",
    sections: Object.freeze(sectionPlans),
  });
}

export function createSectionPayoffIntent(song, sectionId) {
  const plan = createMusicalPayoffPlan(song);
  return plan.sections.find((section) => String(section?.sectionId ?? "") === String(sectionId ?? ""))
    ?? null;
}

export function evaluateMusicalPayoffArc(song) {
  const plan = createMusicalPayoffPlan(song);
  const sections = Array.isArray(song?.structure) ? song.structure : [];
  if (!sections.length || !Array.isArray(song?.tracks)) {
    return Object.freeze({
      version: 2,
      authority: "musical-payoff-audit-v2",
      mode: "read-only",
      sourceAuthority: plan.sourceAuthority,
      available: false,
      passed: true,
      score: 100,
      issues: Object.freeze([]),
      sections: Object.freeze([]),
      transitions: Object.freeze([]),
    });
  }

  const observed = sections.map((section, index) => {
    const intent = plan.sections[index];
    const pressure = observedSectionPressure(song, section);
    return Object.freeze({
      ...intent,
      observedPressure: pressure.pressure,
      activeRoles: pressure.activeRoles,
      notesPerBeat: pressure.notesPerBeat,
      meanVelocity: pressure.meanVelocity,
      foregroundShare: pressure.foregroundShare,
      targetError: round(Math.abs(pressure.pressure - intent.targetEnergy)),
      densityWithinCeiling: pressure.notesPerBeat <= intent.densityCeiling * 6 + 1e-6,
    });
  });

  const issues = [];
  const transitions = [];
  for (let index = 1; index < observed.length; index += 1) {
    const previous = observed[index - 1];
    const current = observed[index];
    const delta = round(current.observedPressure - previous.observedPressure);
    const expectedLift = current.mustLiftFromPrevious;
    const expectedBreath = ["recovery", "release"].includes(current.phase);
    const liftHealthy = !expectedLift || delta >= 0.035;
    const breathHealthy = !expectedBreath || delta <= -0.035;
    if (!liftHealthy) issues.push(`weak-lift:${current.sectionId}`);
    if (!breathHealthy) issues.push(`missing-breath:${current.sectionId}`);
    transitions.push(Object.freeze({
      fromSectionId: previous.sectionId,
      toSectionId: current.sectionId,
      pressureDelta: delta,
      expectedLift,
      expectedBreath,
      liftHealthy,
      breathHealthy,
    }));
  }

  const opening = observed[0] ?? null;
  const firstPayoff = observed.find((entry) => entry.phase === "payoff") ?? null;
  if (
    opening
    && firstPayoff
    && opening.observedPressure > firstPayoff.observedPressure - 0.06
  ) {
    issues.push("opening-too-hot");
  }

  const nonPayoffOverload = observed.filter((entry) => (
    entry.phase !== "payoff"
    && !entry.densityWithinCeiling
    && entry.activeRoles >= 6
  ));
  for (const entry of nonPayoffOverload) issues.push(`hectic-section:${entry.sectionId}`);

  const meanError = observed.length
    ? observed.reduce((sum, entry) => sum + entry.targetError, 0) / observed.length
    : 0;
  const transitionFailures = transitions.filter((entry) => !entry.liftHealthy || !entry.breathHealthy).length;
  const score = Math.round(clamp(
    1
    - Math.min(0.55, meanError * 0.85)
    - Math.min(0.3, transitionFailures * 0.08)
    - Math.min(0.2, nonPayoffOverload.length * 0.08),
  ) * 100);

  return Object.freeze({
    version: 2,
    authority: "musical-payoff-audit-v2",
    mode: "read-only",
    sourceAuthority: plan.sourceAuthority,
    available: true,
    passed: issues.length === 0,
    score,
    issues: Object.freeze(issues),
    sections: Object.freeze(observed),
    transitions: Object.freeze(transitions),
  });
}
