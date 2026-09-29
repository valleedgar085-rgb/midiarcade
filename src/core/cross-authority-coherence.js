import { createProfessionalGenerationGauntletSong } from "./professional-gauntlet-song.js";
import { evaluateGrooveAuthorityLock } from "./groove-authority-lock.js";
import { evaluateEnsembleCoordinationAuthority } from "./ensemble-coordination-authority.js";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function signature(value) {
  const source = JSON.stringify(stable(value));
  let hash = 2166136261;
  for (const char of source) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sectionIds(song) {
  return (song?.structure ?? song?.sections ?? []).map((section) => String(section?.id ?? ""));
}

function grooveSectionIds(song) {
  return [...new Set((song?.grooveConductor?.bars ?? []).map((bar) => String(bar?.sectionId ?? "")).filter(Boolean))];
}

function specialistContexts(plan) {
  return (plan?.specialists ?? []).map((specialist) => ({
    id: specialist?.id ?? null,
    grooveDNA: specialist?.context?.grooveDNA ?? specialist?.grooveDNA ?? null,
    harmonyTimeline: specialist?.context?.harmonyTimeline ?? null,
    sections: specialist?.context?.sections ?? null,
  }));
}

/**
 * Read-only cross-authority coherence gate.
 *
 * This gate never repairs or rewrites music. It verifies that the accepted
 * structure, harmony, Groove DNA, specialist contexts, and final note state
 * still describe the same musical world.
 */
export function evaluateCrossAuthorityCoherence(song, { specialistPlan = null } = {}) {
  if (!song || !Array.isArray(song?.tracks)) {
    return Object.freeze({
      version: 1,
      authority: "cross-authority-coherence-v1",
      mode: "read-only",
      passed: false,
      score: 0,
      issues: Object.freeze(["invalid-song"]),
      checks: Object.freeze({}),
    });
  }

  const gauntlet = createProfessionalGenerationGauntletSong(song);
  const sourceGrooveDNA = song?.grooveConductor?.grooveDNA ?? null;
  const contexts = specialistContexts(specialistPlan);
  const issues = [];

  const structureSignature = signature(gauntlet.sections ?? []);
  const harmonySignature = signature(gauntlet.harmonyTimeline ?? []);
  const grooveTimelineSignature = signature(gauntlet.grooveTimeline ?? []);
  const grooveDNASignature = sourceGrooveDNA ? signature(sourceGrooveDNA) : null;

  const specialistGrooveSignatures = contexts
    .filter((entry) => entry.grooveDNA)
    .map((entry) => ({ id: entry.id, signature: signature(entry.grooveDNA) }));
  const specialistHarmonySignatures = contexts
    .filter((entry) => entry.harmonyTimeline)
    .map((entry) => ({ id: entry.id, signature: signature(entry.harmonyTimeline) }));
  const specialistSectionSignatures = contexts
    .filter((entry) => entry.sections)
    .map((entry) => ({ id: entry.id, signature: signature(entry.sections) }));

  const specialistsShareGrooveDNA = !grooveDNASignature
    || specialistGrooveSignatures.every((entry) => entry.signature === grooveDNASignature);
  if (!specialistsShareGrooveDNA) issues.push("specialist-groove-dna-drift");

  const specialistsShareHarmony = specialistHarmonySignatures.every(
    (entry) => entry.signature === harmonySignature,
  );
  if (!specialistsShareHarmony) issues.push("specialist-harmony-drift");

  const specialistsShareStructure = specialistSectionSignatures.every(
    (entry) => entry.signature === structureSignature,
  );
  if (!specialistsShareStructure) issues.push("specialist-structure-drift");

  const expectedSections = sectionIds(song);
  const grooveSections = grooveSectionIds(song);
  const grooveSectionsKnown = grooveSections.every((id) => expectedSections.includes(id));
  if (!grooveSectionsKnown) issues.push("groove-section-drift");

  const grooveLock = evaluateGrooveAuthorityLock(
    song.tracks,
    song.grooveConductor,
    { beatsPerBar: song?.meta?.beatsPerBar ?? 4 },
  );
  const grooveTimingStable = grooveLock.status === "unavailable"
    || grooveLock.checks?.postCompositionTimingStable === true;
  const protectedNegativeSpace = grooveLock.status === "unavailable"
    || grooveLock.checks?.protectedNegativeSpace === true;
  if (!grooveTimingStable) issues.push("post-composition-groove-timing-drift");
  if (!protectedNegativeSpace) issues.push("groove-negative-space-violation");

  const ensemble = evaluateEnsembleCoordinationAuthority(song);
  const ensembleAvailable = ensemble.reason !== "missing-ensemble-contracts";
  const rhythmFoundationCoherent = !ensembleAvailable || ensemble.metrics?.rhythmFoundation >= 0.45;
  const harmonicSupportCoherent = !ensembleAvailable || ensemble.metrics?.harmonicSupport >= 0.5;
  const leadDialogueCoherent = !ensembleAvailable || ensemble.metrics?.leadDialogue >= 0.55;
  const cadenceTeamCoherent = !ensembleAvailable || ensemble.metrics?.cadenceTeam >= 0.5;
  const sectionEvolutionCoherent = !ensembleAvailable || (
    ensemble.metrics?.arrangementBreathingRoom >= 0.55
    && ensemble.metrics?.allLayersAlwaysOn !== true
  );
  if (!rhythmFoundationCoherent) issues.push("drum-bass-foundation-weak");
  if (!harmonicSupportCoherent) issues.push("harmonic-support-weak");
  if (!leadDialogueCoherent) issues.push("lead-dialogue-weak");
  if (!cadenceTeamCoherent) issues.push("phrase-resolution-team-weak");
  if (!sectionEvolutionCoherent) issues.push("section-role-evolution-flat");

  const checks = Object.freeze({
    specialistsShareGrooveDNA,
    specialistsShareHarmony,
    specialistsShareStructure,
    grooveSectionsKnown,
    grooveTimingStable,
    protectedNegativeSpace,
    rhythmFoundationCoherent,
    harmonicSupportCoherent,
    leadDialogueCoherent,
    cadenceTeamCoherent,
    sectionEvolutionCoherent,
  });
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedChecks / Object.keys(checks).length) * 100);

  return Object.freeze({
    version: 2,
    authority: "cross-authority-coherence-v2",
    mode: "read-only",
    passed: issues.length === 0,
    score,
    repairs: 0,
    issues: Object.freeze(issues),
    signatures: Object.freeze({
      structure: structureSignature,
      harmony: harmonySignature,
      grooveTimeline: grooveTimelineSignature,
      grooveDNA: grooveDNASignature,
    }),
    checks,
    grooveLock,
    ensemble,
    specialistSignatures: Object.freeze({
      grooveDNA: Object.freeze(specialistGrooveSignatures),
      harmony: Object.freeze(specialistHarmonySignatures),
      structure: Object.freeze(specialistSectionSignatures),
    }),
  });
}
