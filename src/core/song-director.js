function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function normalizedName(section) {
  return String(section?.name ?? section?.sectionName ?? section?.id ?? "section").toLowerCase();
}

function purposeFor(name, role) {
  const purposes = {
    intro: "establish atmosphere and identity",
    verse: "establish identity and create room for development",
    prechorus: "increase anticipation before the payoff",
    chorus: "release accumulated tension and deliver the primary hook",
    bridge: "create contrast without losing song identity",
    build: "increase anticipation before the payoff",
    drop: "release accumulated tension with maximum rhythmic impact",
    breakdown: "reset density and create contrast",
    outro: "resolve the song and reduce unresolved motion",
    theme: "state the song identity clearly",
    idea: "introduce the primary musical idea",
    solo: "spotlight one foreground voice while preserving the band",
  };
  return purposes[name]
    ?? (role === "peak" ? "deliver the song's strongest payoff"
      : role === "release" ? "release tension and resolve"
        : "develop the established musical identity");
}

function densityDirective(name, plan) {
  const target = round(clamp(plan?.density ?? 0.58, 0.1, 1));
  if (["prechorus", "build"].includes(name)) {
    return Object.freeze({ state: "rising", start: round(target * 0.78), target: round(Math.max(target, 0.72)), end: round(Math.min(1, target * 1.08)) });
  }
  if (["chorus", "drop"].includes(name)) {
    return Object.freeze({ state: "full", start: round(Math.max(0.72, target * 0.94)), target: round(Math.max(0.82, target)), end: round(Math.max(0.78, target * 0.96)) });
  }
  if (["breakdown", "intro"].includes(name)) {
    return Object.freeze({ state: "restrained", start: round(target * 0.72), target: round(target * 0.82), end: round(target * 0.88) });
  }
  if (name === "outro") {
    return Object.freeze({ state: "falling", start: target, target: round(target * 0.78), end: round(target * 0.58) });
  }
  if (name === "verse") {
    return Object.freeze({ state: "restrained", start: round(target * 0.82), target: round(target * 0.92), end: target });
  }
  return Object.freeze({ state: "steady", start: target, target, end: target });
}

function harmonicTensionDirective(name, plan) {
  const envelope = plan?.tensionEnvelope ?? {};
  const start = round(clamp(envelope.start ?? plan?.tension ?? 0.5, 0, 1));
  const peak = round(clamp(envelope.peak ?? plan?.tension ?? 0.5, 0, 1));
  const end = round(clamp(envelope.end ?? plan?.tension ?? 0.5, 0, 1));
  const behavior = ["prechorus", "build"].includes(name) ? "increasing"
    : ["chorus", "drop"].includes(name) ? "release-after-impact"
      : name === "outro" ? "resolving"
        : ["bridge", "breakdown"].includes(name) ? "contrast"
          : "controlled";
  return Object.freeze({ behavior, start, peak, end });
}

function verseBassEntry(section) {
  const bars = Math.max(1, Math.round(finite(section?.bars, 1)));
  if (bars >= 8) return 5;
  if (bars >= 4) return 2;
  return 1;
}

function instrumentDirectives(name, section, plan, matrix) {
  const energy = clamp(plan?.energy ?? section?.intensity ?? 0.5, 0, 1);
  const peak = ["chorus", "drop"].includes(name);
  const build = ["prechorus", "build"].includes(name);
  const verse = name === "verse";
  const restrained = ["intro", "breakdown", "outro"].includes(name);
  const motif = String(plan?.motifTransform ?? "statement");

  return Object.freeze({
    drums: Object.freeze({
      role: peak ? "strongest-pattern" : build ? "build-pressure" : verse ? "pocket" : restrained ? "restrained" : "support",
      intensity: round(peak ? Math.max(0.88, energy) : energy),
      hatBehavior: build ? "accelerate" : peak ? "full-drive" : verse ? "pocket" : restrained ? "sparse" : "follow-groove-dna",
      fillPolicy: build ? "controlled-lift" : peak ? "assertive-but-not-continuous" : "phrase-boundary-only",
    }),
    bass: Object.freeze({
      role: peak ? "hook-pattern-B" : build ? "simplified" : verse ? "identity-pocket" : restrained ? "minimal-support" : "foundation",
      entryBarWithinSection: verse ? verseBassEntry(section) : 1,
      relationship: build ? "reduce-motion-under-rising-tension" : peak ? "lock-to-primary-hook" : "follow-groove-dna",
    }),
    chords: Object.freeze({
      role: verse ? "sparse" : build ? "tension-builder" : peak ? "full-support" : restrained ? "open-space" : "support",
      density: verse ? "sparse" : build ? "rising" : peak ? "full" : "controlled",
      harmonicMotion: plan?.harmonicRole ?? "follow-harmony-timeline",
    }),
    lead: Object.freeze({
      motifId: "A",
      behavior: build ? "rising-variation" : peak ? "payoff" : verse ? "statement" : motif,
      foreground: matrix?.featuredTrack === "melody",
    }),
    counterline: Object.freeze({
      activity: peak ? "active" : verse ? "selective-answer" : build ? "restrained-answer" : restrained ? "minimal" : "conversational",
      foreground: matrix?.featuredTrack === "counterpoint",
    }),
    arp: Object.freeze({
      activity: build ? "increase-motion" : peak ? "support-payoff" : restrained ? "atmospheric" : "support",
      density: build ? "rising" : peak ? "full" : "controlled",
    }),
    fx: Object.freeze({
      role: build ? "riser-and-vacuum" : peak ? "impact-and-release" : verse ? "transition-support" : "section-punctuation",
    }),
  });
}

function transitionDirective(name, section, transition, nextName, beatsPerBar) {
  const intoPayoff = ["prechorus", "build"].includes(name) && ["chorus", "drop"].includes(nextName);
  const vacuumBeats = intoPayoff ? round(beatsPerBar / 2) : 0;
  return Object.freeze({
    type: transition?.type ?? (intoPayoff ? "launch" : "none"),
    strength: round(clamp(transition?.strength ?? (intoPayoff ? 0.82 : 0.5), 0, 1)),
    pickupBeats: round(Math.max(0, finite(transition?.pickupBeats, intoPayoff ? beatsPerBar / 2 : 0.5))),
    vacuumBeats,
    vacuum: vacuumBeats > 0,
    nextSectionId: transition?.toSectionId ?? null,
    nextSectionName: nextName ?? null,
  });
}

export function createSongDirectorContract({
  config = {},
  structure = [],
  sectionPlans = [],
  transitions = [],
  orchestrationMatrix = [],
} = {}) {
  const beatsPerBar = Math.max(1, finite(config?.timeSignature?.[0], finite(config?.beatsPerBar, 4)));
  const planBySection = new Map(sectionPlans.map((plan) => [String(plan?.sectionId), plan]));
  const matrixBySection = new Map(orchestrationMatrix.map((entry) => [String(entry?.sectionId), entry]));
  const transitionBySection = new Map(transitions.map((transition) => [String(transition?.fromSectionId), transition]));

  const sections = structure.map((section, index) => {
    const sectionId = String(section?.id ?? `section-${index + 1}`);
    const name = normalizedName(section);
    const plan = planBySection.get(sectionId) ?? sectionPlans[index] ?? {};
    const matrix = matrixBySection.get(sectionId) ?? {};
    const transition = transitionBySection.get(sectionId) ?? null;
    const next = structure[index + 1] ?? null;
    const nextName = next ? normalizedName(next) : null;
    const energy = round(clamp(plan?.energy ?? section?.intensity ?? 0.5, 0, 1));
    const density = densityDirective(name, plan);
    const harmonicTension = harmonicTensionDirective(name, plan);
    const instruments = instrumentDirectives(name, section, plan, matrix);
    const transitionOut = transitionDirective(name, section, transition, nextName, beatsPerBar);

    return Object.freeze({
      sectionId,
      sectionName: name,
      order: index,
      startBar: Math.max(0, Math.round(finite(section?.startBar, 0))),
      bars: Math.max(1, Math.round(finite(section?.bars, 1))),
      energy: Object.freeze({
        normalized: energy,
        score: Math.round(energy * 100),
      }),
      density,
      harmonicTension,
      purpose: purposeFor(name, plan?.role),
      cadence: plan?.cadence ?? "open",
      motifTransform: plan?.motifTransform ?? "statement",
      instruments,
      transitionOut,
      rules: Object.freeze({
        preserveMotifIdentity: true,
        obeyHarmonyTimeline: true,
        obeyGrooveDNA: true,
        doNotMaxEveryInstrument: true,
        leaveIntentionalSpace: density.state !== "full",
      }),
    });
  });

  return Object.freeze({
    version: 1,
    id: "song-director-conductor-v1",
    createdBeforeNotes: true,
    authorityOrder: Object.freeze([
      "musical-intent",
      "section-blueprint",
      "harmony-brain",
      "groove-brain",
      "specialist-musicians",
      "ensemble-checker",
    ]),
    sectionCount: sections.length,
    sections: Object.freeze(sections),
  });
}

export function directorSectionFor(songDirector, sectionId) {
  return songDirector?.sections?.find((section) => String(section?.sectionId) === String(sectionId)) ?? null;
}

export function validateSongDirectorContract(songDirector, structure = []) {
  const issues = [];
  if (songDirector?.id !== "song-director-conductor-v1") issues.push("director:invalid-id");
  if (songDirector?.createdBeforeNotes !== true) issues.push("director:not-precomposition");
  if (!Array.isArray(songDirector?.sections)) issues.push("director:sections-missing");
  else {
    if (structure.length && songDirector.sections.length !== structure.length) issues.push("director:section-coverage");
    for (const section of songDirector.sections) {
      if (!section?.purpose) issues.push(`director:purpose:${section?.sectionId}`);
      if (!Number.isInteger(section?.energy?.score)) issues.push(`director:energy:${section?.sectionId}`);
      if (!section?.density?.state) issues.push(`director:density:${section?.sectionId}`);
      if (!section?.harmonicTension?.behavior) issues.push(`director:tension:${section?.sectionId}`);
      for (const role of ["drums", "bass", "chords", "lead", "counterline", "arp", "fx"]) {
        if (!section?.instruments?.[role]) issues.push(`director:instrument:${role}:${section?.sectionId}`);
      }
    }
  }
  return Object.freeze({ passed: issues.length === 0, issues: Object.freeze([...new Set(issues)]) });
}
