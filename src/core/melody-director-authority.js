export const MELODY_DIRECTOR_AUTHORITY_VERSION = 1;

export const MIN_PHRASE_PLACEMENT_SCORE = 0.76;
export const MIN_PHRASE_CONVERSATION_SCORE = 0.72;
export const MIN_MELODIC_ARC_PAYOFF_SCORE = 0.7;

export const MELODY_DIRECTOR_AUTHORITY_ORDER = Object.freeze([
  Object.freeze({
    id: "5d-phrase-placement",
    phase: "5D",
    owner: "melodyPhraseRefinement",
    responsibility: "phrase-start-placement",
    mutation: "timing",
  }),
  Object.freeze({
    id: "5e-phrase-conversation",
    phase: "5E",
    owner: "melodyPhraseRefinement",
    responsibility: "call-response-development",
    mutation: "pitch",
  }),
  Object.freeze({
    id: "5f-local-melodic-arc",
    phase: "5F",
    owner: "melodyPhraseRefinement",
    responsibility: "within-section-arc",
    mutation: "pitch",
  }),
  Object.freeze({
    id: "5g-motif-recall",
    phase: "5G",
    owner: "melodySectionDevelopmentRefinement",
    responsibility: "cross-section-motif-memory",
    mutation: "pitch",
  }),
  Object.freeze({
    id: "5h-section-story-payoff",
    phase: "5H",
    owner: "melodySectionDevelopmentRefinement",
    responsibility: "cross-section-payoff",
    mutation: "pitch",
  }),
  Object.freeze({
    id: "final-memory-audit",
    phase: "5I",
    owner: "melodySectionMemoryAudit",
    responsibility: "committed-read-only-audit",
    mutation: "none",
  }),
]);

const PAYOFF_SECTION_NAMES = Object.freeze([
  "chorus",
  "hook",
  "drop",
  "refrain",
  "theme",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizedSectionName(section) {
  return String(section?.name ?? section?.type ?? section?.role ?? "").toLowerCase();
}

function structure(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}

function phraseMemoryContract(song, sectionId) {
  return (song?.phraseMemory?.sections ?? []).find(
    (entry) => String(entry?.sectionId) === String(sectionId),
  ) ?? null;
}

export function melodyDirectorSectionOwnership(song, sectionId) {
  const section = structure(song).find(
    (entry) => String(entry?.id) === String(sectionId),
  ) ?? null;
  const memory = phraseMemoryContract(song, sectionId);
  const name = normalizedSectionName(section);
  const payoffSection = PAYOFF_SECTION_NAMES.some((label) => name.includes(label));
  const relationship = String(memory?.relationship ?? "");
  const sourceSectionId = memory?.sourceSectionId ?? memory?.originSectionId ?? null;
  const crossSectionMemory = sourceSectionId != null
    && String(sourceSectionId) !== String(sectionId)
    && ["recall", "return"].includes(relationship);
  const sectionStoryOwnsPayoff = payoffSection && crossSectionMemory;

  return Object.freeze({
    sectionId: sectionId == null ? null : String(sectionId),
    sectionName: name,
    relationship,
    sourceSectionId: sourceSectionId == null ? null : String(sourceSectionId),
    payoffSection,
    crossSectionMemory,
    localArcOwner: sectionStoryOwnsPayoff ? "5H" : "5F",
    sectionStoryOwner: sectionStoryOwnsPayoff ? "5H" : null,
    sectionStoryOwnsPayoff,
  });
}

export function resolveMelodyDirectorPhraseNeed(report) {
  const placement = report?.weakestPlacementSection ?? null;
  const placementScore = finite(placement?.metrics?.phrasePlacement, 1);
  if (placement?.sectionId != null && placementScore < MIN_PHRASE_PLACEMENT_SCORE) {
    return Object.freeze({
      authorityId: "5d-phrase-placement",
      phase: "5D",
      sectionId: String(placement.sectionId),
      metric: "phrasePlacement",
      score: placementScore,
      threshold: MIN_PHRASE_PLACEMENT_SCORE,
    });
  }

  const conversation = report?.weakestConversationSection ?? null;
  const conversationScore = finite(conversation?.metrics?.phraseConversation, 1);
  if (
    conversation?.sectionId != null
    && conversationScore < MIN_PHRASE_CONVERSATION_SCORE
  ) {
    return Object.freeze({
      authorityId: "5e-phrase-conversation",
      phase: "5E",
      sectionId: String(conversation.sectionId),
      metric: "phraseConversation",
      score: conversationScore,
      threshold: MIN_PHRASE_CONVERSATION_SCORE,
    });
  }

  const arc = report?.weakestArcSection ?? null;
  const arcScore = finite(arc?.metrics?.melodicArcPayoff, 1);
  if (arc?.sectionId != null && arcScore < MIN_MELODIC_ARC_PAYOFF_SCORE) {
    return Object.freeze({
      authorityId: "5f-local-melodic-arc",
      phase: "5F",
      sectionId: String(arc.sectionId),
      metric: "melodicArcPayoff",
      score: arcScore,
      threshold: MIN_MELODIC_ARC_PAYOFF_SCORE,
    });
  }

  const weakest = report?.weakestSection ?? null;
  return Object.freeze({
    authorityId: "phrase-polish",
    phase: "legacy-polish",
    sectionId: weakest?.sectionId == null ? null : String(weakest.sectionId),
    metric: "phraseScore",
    score: finite(weakest?.score, finite(report?.score)),
    threshold: null,
  });
}

export function melodyDirectorAuthoritySnapshot(song, phraseReport = null) {
  const sectionOwnership = structure(song).map((section) => (
    melodyDirectorSectionOwnership(song, section?.id)
  ));
  return Object.freeze({
    version: MELODY_DIRECTOR_AUTHORITY_VERSION,
    order: MELODY_DIRECTOR_AUTHORITY_ORDER,
    phraseNeed: phraseReport ? resolveMelodyDirectorPhraseNeed(phraseReport) : null,
    sectionOwnership: Object.freeze(sectionOwnership),
  });
}
