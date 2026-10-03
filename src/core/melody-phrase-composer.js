import { clampFinite as clamp, finite } from "../utils.js";

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function normalizeBars(value) {
  const bars = Math.max(1, Math.round(finite(value, 1)));
  if (bars <= 2) return 2;
  if (bars <= 4) return 4;
  return 8;
}

function phraseCount(sectionBars, phraseBars) {
  return Math.max(1, Math.ceil(Math.max(1, sectionBars) / Math.max(1, phraseBars)));
}

function restBudgetFor({ role, relationship, index, count }) {
  const endingPhrase = index === count - 1;
  if (role === "intro") return 0.34;
  if (role === "peak") return endingPhrase ? 0.16 : 0.12;
  if (relationship === "contrast") return 0.28;
  if (["recall", "return"].includes(relationship)) return endingPhrase ? 0.2 : 0.24;
  return endingPhrase ? 0.22 : 0.26;
}

function sentenceRoleFor(index, count, sectionSentenceRole) {
  if (count === 1) return sectionSentenceRole ?? "statement";
  if (index === count - 1 && ["resolution", "return", "callback"].includes(sectionSentenceRole)) {
    return sectionSentenceRole;
  }
  return index % 2 === 0 ? "question" : "answer";
}

function landingIntentFor(sentenceRole, sectionLandingRole, finalPhrase) {
  if (finalPhrase && sectionLandingRole) return sectionLandingRole;
  if (sentenceRole === "question") return "open";
  if (sentenceRole === "answer") return "settle";
  if (sentenceRole === "resolution") return "resolve";
  if (sentenceRole === "return" || sentenceRole === "callback") return "remember";
  return "continue";
}

function registerMotionFor(registerStrategy, sentenceRole) {
  if (registerStrategy === "lift") return "up";
  if (registerStrategy === "drop" || registerStrategy === "settle") return "down";
  if (registerStrategy === "hold" || registerStrategy === "preserve") {
    return sentenceRole === "question" ? "slight-up" : "slight-down";
  }
  if (registerStrategy === "separate") return "contrast";
  return "center";
}

function targetKindFor(sentenceRole, finalPhrase) {
  if (finalPhrase && sentenceRole === "resolution") return "cadence-tone";
  if (sentenceRole === "question") return "tension-tone";
  if (["answer", "return", "callback"].includes(sentenceRole)) return "chord-tone";
  return "guide-tone";
}

/**
 * Melody Director v2.
 *
 * Builds a deterministic, note-free phrase plan from the existing section
 * memory contract. This is an upstream composition contract: it describes what
 * each phrase is trying to say without mutating MIDI or weakening downstream
 * critics.
 */
export function createMelodyPhrasePlan({
  section = {},
  memory = {},
  nextSection = null,
  beatsPerBar = 4,
} = {}) {
  const sectionBars = Math.max(1, Math.round(finite(section?.bars, 1)));
  const phraseBars = normalizeBars(sectionBars);
  const count = phraseCount(sectionBars, phraseBars);
  const role = String(section?.role ?? section?.name ?? "").toLowerCase();
  const relationship = String(memory?.relationship ?? "statement");
  const sectionSentenceRole = memory?.sentenceRole ?? "statement";
  const sectionLandingRole = memory?.landingRole ?? "answer";
  const registerStrategy = memory?.registerStrategy ?? "preserve";
  const sourceSectionId = memory?.sourceSectionId ?? section?.id ?? null;
  const phrases = [];

  for (let index = 0; index < count; index += 1) {
    const finalPhrase = index === count - 1;
    const sentenceRole = sentenceRoleFor(index, count, sectionSentenceRole);
    const bars = Math.min(
      phraseBars,
      Math.max(1, sectionBars - index * phraseBars),
    );
    phrases.push(Object.freeze({
      phraseIndex: index,
      startBarOffset: index * phraseBars,
      bars,
      beats: bars * Math.max(1, finite(beatsPerBar, 4)),
      sentenceRole,
      sourceSectionId,
      relationship,
      transform: memory?.transform ?? "statement",
      restBudget: round(clamp(restBudgetFor({ role, relationship, index, count }), 0.08, 0.42)),
      landingIntent: landingIntentFor(sentenceRole, sectionLandingRole, finalPhrase),
      targetKind: targetKindFor(sentenceRole, finalPhrase),
      registerMotion: registerMotionFor(registerStrategy, sentenceRole),
      motifRecall: round(clamp(memory?.motifMemory?.contourRecall ?? 1, 0, 1)),
      rhythmRecall: round(clamp(memory?.motifMemory?.rhythmRecall ?? 1, 0, 1)),
      endingRecall: round(clamp(memory?.motifMemory?.endingRecall ?? 1, 0, 1)),
      lookAhead: Object.freeze({
        enabled: Boolean(finalPhrase && nextSection),
        nextSectionId: finalPhrase ? nextSection?.id ?? null : null,
        nextSectionRole: finalPhrase ? nextSection?.role ?? nextSection?.name ?? null : null,
        intent: finalPhrase && nextSection ? "prepare-next-section" : "stay-local",
      }),
    }));
  }

  return Object.freeze({
    version: 2,
    authority: "melody-director-v2",
    mode: "phrase-plan",
    sectionId: section?.id ?? null,
    sectionBars,
    phraseBars,
    phraseCount: count,
    phrases: Object.freeze(phrases),
    mutatesNotes: false,
    deterministic: true,
  });
}
