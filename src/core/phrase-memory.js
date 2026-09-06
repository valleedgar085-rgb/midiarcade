import { phraseLandingProfile } from "./phrase-architecture.js";

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function landingRoleFor({ cadence, relationship, index, role }) {
  if (cadence === "resolve") return "resolution";
  if (cadence === "lift") return "lift";
  if (cadence === "suspend") return "suspension";
  if (relationship === "contrast") return "question";
  if (["recall", "return"].includes(relationship)) return "answer";
  if (role === "peak") return "resolution";
  return index % 2 === 0 ? "question" : "answer";
}

function transformFor({ relationship, contrastAxis, seed = 0, landingRole }) {
  if (relationship === "return") return "motif-return";
  if (relationship === "contrast") {
    return {
      rhythm: "rhythmic-displacement",
      register: "register-reframe",
      density: "density-contrast",
      harmony: "harmonic-reframe",
    }[contrastAxis] ?? "contrast-response";
  }
  if (relationship === "recall") {
    const choices = ["contour-echo", "rhythmic-echo", "ending-answer"];
    return choices[Math.abs(Math.round(finite(seed))) % choices.length];
  }
  if (landingRole === "lift") return "ascending-setup";
  if (landingRole === "resolution") return "cadential-answer";
  return "statement";
}

function registerStrategyFor({ relationship, contrastAxis, direction = 1, landingRole }) {
  if (contrastAxis === "register") return direction >= 0 ? "lift" : "drop";
  if (relationship === "contrast") return "separate";
  if (landingRole === "lift") return "lift";
  if (landingRole === "resolution") return "settle";
  if (landingRole === "suspension") return "hold";
  return "preserve";
}

function sentenceRoleFor(relationship, landingRole) {
  if (landingRole === "resolution") return "resolution";
  if (relationship === "return") return "return";
  if (relationship === "recall") return "callback";
  if (relationship === "contrast") return "contrast";
  if (landingRole === "question") return "question";
  if (landingRole === "answer") return "answer";
  return "statement";
}

/**
 * Convert section-level musical memory into a deterministic phrase conversation
 * contract. The contract describes how a section remembers prior material and
 * how performers should phrase its ending; it does not render notes itself.
 */
export function createPhraseMemoryContract({
  structure = [],
  sectionPlans = [],
  memoryMap = [],
  songDNA = null,
} = {}) {
  const plans = new Map(sectionPlans.map((plan) => [plan.sectionId, plan]));
  const memories = new Map(memoryMap.map((memory) => [memory.sectionId, memory]));
  const dnaSections = new Map((songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  const direction = songDNA?.melodic?.direction === -1 ? -1 : 1;

  const sections = structure.map((section, index) => {
    const plan = plans.get(section.id) ?? {};
    const memory = memories.get(section.id) ?? {
      sectionId: section.id,
      originSectionId: section.id,
      relationship: index === 0 ? "introduction" : "statement",
      recallStrength: 1,
      contrastAxis: "none",
    };
    const dna = dnaSections.get(section.id) ?? {};
    const landingRole = landingRoleFor({
      cadence: plan.cadence,
      relationship: memory.relationship,
      index,
      role: plan.role,
    });
    const landing = phraseLandingProfile(landingRole);
    const recallStrength = clamp(memory.recallStrength ?? 1, 0, 1);
    const seed = finite(dna.phraseSeed, index);
    const transform = transformFor({
      relationship: memory.relationship,
      contrastAxis: memory.contrastAxis,
      seed,
      landingRole,
    });
    const registerStrategy = registerStrategyFor({
      relationship: memory.relationship,
      contrastAxis: memory.contrastAxis,
      direction,
      landingRole,
    });
    const recalled = ["recall", "return", "contrast"].includes(memory.relationship);

    return {
      sectionId: section.id,
      sectionName: section.name,
      sourceSectionId: memory.originSectionId ?? section.id,
      relationship: memory.relationship ?? "statement",
      sentenceRole: sentenceRoleFor(memory.relationship, landingRole),
      landingRole,
      transform,
      contrastAxis: memory.contrastAxis ?? "none",
      registerStrategy,
      recallStrength: round(recallStrength),
      phraseSeed: Number.isFinite(Number(dna.phraseSeed)) ? Number(dna.phraseSeed) : null,
      motifMemory: {
        contourRecall: round(recalled ? 0.48 + recallStrength * 0.42 : 1),
        rhythmRecall: round(recalled ? 0.55 + recallStrength * 0.38 : 1),
        endingRecall: round(
          landingRole === "answer" || landingRole === "resolution"
            ? 0.7 + recallStrength * 0.25
            : 0.5 + recallStrength * 0.2,
        ),
      },
      performance: {
        direction: landing.direction,
        avoidRoot: landing.avoidRoot,
        durationScale: round(landing.durationScale),
        velocityDelta: Math.round(landing.velocityDelta),
        articulation: landing.articulation,
      },
    };
  });

  return {
    version: 1,
    familyId: songDNA?.familyId ?? null,
    sections,
  };
}

export function phraseMemoryForSection(contract, sectionId) {
  const sections = Array.isArray(contract) ? contract : contract?.sections;
  return sections?.find((entry) => entry.sectionId === sectionId) ?? null;
}

/**
 * Bounded phrase-ending performance adjustment. Only turnaround/ending cells
 * receive the landing delta, keeping normal groove dynamics unchanged.
 */
export function phrasePerformanceAdjustment(memory, trackId, phraseRole) {
  if (!memory || phraseRole !== "turnaround") return 0;
  const laneWeight = {
    melody: 1,
    counterpoint: 0.8,
    chords: 0.45,
    bass: 0.35,
    drums: 0.3,
    pad: 0.25,
  }[trackId] ?? 0.25;
  const relationshipWeight = memory.relationship === "contrast" ? 0.72
    : ["recall", "return"].includes(memory.relationship) ? 1
      : 0.82;
  return Math.round(clamp(
    finite(memory.performance?.velocityDelta, 0)
      * laneWeight
      * relationshipWeight
      * clamp(memory.recallStrength ?? 1, 0.35, 1),
    -6,
    6,
  ));
}

/**
 * Interpret phrase-performance metadata only at playback/export boundaries.
 * The composition JSON keeps its critic-calibrated pitch/timing/velocity data;
 * renderers receive one shared, bounded interpretation for audible nuance.
 */
export function renderPhrasePerformance(note = {}) {
  return {
    velocityDelta: Math.round(clamp(finite(note.phrasePerformanceDelta, 0), -6, 6)),
    durationScale: round(clamp(finite(note.phrasePerformanceDurationScale, 1), 0.72, 1.28)),
  };
}
