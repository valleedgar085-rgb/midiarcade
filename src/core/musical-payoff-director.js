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

function sectionPhase(section, index, total) {
  const name = normalizeName(section);
  if (/(intro|opening)/.test(name) || index === 0) return "opening";
  if (/(pre|build|riser|build-up|buildup)/.test(name)) return "build";
  if (/(chorus|drop|hook|refrain|payoff)/.test(name)) return "payoff";
  if (/(breakdown|break|bridge|interlude|reset)/.test(name)) return "recovery";
  if (/(outro|ending|end)/.test(name) || index === total - 1) return "release";
  return "body";
}

function blueprintArc(song) {
  const arc = song?.songBlueprint?.intent?.energyArc
    ?? song?.producerBrain?.blueprint?.intent?.energyArc
    ?? {};
  const fallbackEnergy = clamp(finite(
    song?.songBlueprint?.intent?.energy
      ?? song?.producerIntent?.energy
      ?? song?.meta?.energy,
    0.68,
  ));
  return Object.freeze({
    opening: clamp(finite(arc?.opening, fallbackEnergy * 0.72)),
    body: clamp(finite(arc?.body, fallbackEnergy * 0.96)),
    peak: clamp(finite(arc?.peak, Math.min(1, fallbackEnergy + 0.14))),
    release: clamp(finite(arc?.release, Math.max(0.18, fallbackEnergy * 0.58))),
  });
}

function spaceReserve(song) {
  return clamp(finite(
    song?.songBlueprint?.intent?.spaceReserve
      ?? song?.producerBrain?.blueprint?.intent?.spaceReserve,
    0.5,
  ));
}

function targetForPhase(phase, arc, reserve) {
  if (phase === "opening") {
    return {
      energy: arc.opening,
      tension: clamp(0.2 + arc.opening * 0.18),
      space: clamp(reserve + 0.14),
      role: "establish",
    };
  }
  if (phase === "build") {
    return {
      energy: clamp(Math.max(arc.body + 0.04, arc.peak - 0.12)),
      tension: clamp(0.68 + (arc.peak - arc.body) * 0.5),
      space: clamp(reserve - 0.08),
      role: "withhold-and-rise",
    };
  }
  if (phase === "payoff") {
    return {
      energy: arc.peak,
      tension: clamp(0.48 + arc.peak * 0.12),
      space: clamp(reserve - 0.12),
      role: "deliver",
    };
  }
  if (phase === "recovery") {
    return {
      energy: clamp(Math.max(arc.release, arc.body - 0.12)),
      tension: clamp(0.28 + arc.release * 0.12),
      space: clamp(reserve + 0.16),
      role: "breathe",
    };
  }
  if (phase === "release") {
    return {
      energy: arc.release,
      tension: clamp(0.16 + arc.release * 0.1),
      space: clamp(reserve + 0.2),
      role: "resolve",
    };
  }
  return {
    energy: arc.body,
    tension: clamp(0.4 + arc.body * 0.14),
    space: reserve,
    role: "develop",
  };
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

export function createMusicalPayoffPlan(song) {
  const sections = Array.isArray(song?.structure) ? song.structure : [];
  const arc = blueprintArc(song);
  const reserve = spaceReserve(song);
  const sectionPlans = sections.map((section, index) => {
    const phase = sectionPhase(section, index, sections.length);
    const target = targetForPhase(phase, arc, reserve);
    return Object.freeze({
      sectionId: section?.id ?? null,
      name: section?.name ?? section?.type ?? section?.id ?? null,
      phase,
      role: target.role,
      targetEnergy: round(target.energy),
      targetTension: round(target.tension),
      targetSpace: round(target.space),
      payoff: phase === "payoff",
      mustBreathe: ["opening", "recovery", "release"].includes(phase),
      mustLiftFromPrevious: phase === "build" || phase === "payoff",
    });
  });

  return Object.freeze({
    version: 1,
    authority: "musical-payoff-director-v1",
    mode: "pre-composition-intent",
    energyArc: arc,
    spaceReserve: reserve,
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
      version: 1,
      authority: "musical-payoff-director-v1",
      mode: "read-only",
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
    && entry.notesPerBeat > 5.2
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
    version: 1,
    authority: "musical-payoff-director-v1",
    mode: "read-only",
    available: true,
    passed: issues.length === 0,
    score,
    issues: Object.freeze(issues),
    sections: Object.freeze(observed),
    transitions: Object.freeze(transitions),
  });
}
