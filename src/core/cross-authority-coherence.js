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

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 4) {
  const power = 10 ** places;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function sectionRange(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { startBeat, endBeat, length: endBeat - startBeat };
}

function notesInRange(track, range) {
  return (track?.notes ?? []).filter((note) => {
    const start = finite(note?.start, -1);
    return start >= range.startBeat - 1e-6 && start < range.endBeat - 1e-6;
  });
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? section?.id ?? "").toLowerCase();
}

function isPayoffSection(section) {
  return /(chorus|drop|hook|refrain|payoff)/.test(sectionName(section));
}

function roleSet(song, range) {
  return (song?.tracks ?? [])
    .filter((track) => String(track?.id ?? "") !== "fx" && notesInRange(track, range).length > 0)
    .map((track) => String(track.id))
    .sort();
}

function sectionPressure(song, section) {
  const range = sectionRange(song, section);
  const playableTracks = (song?.tracks ?? []).filter((track) => String(track?.id ?? "") !== "fx");
  const notes = playableTracks.flatMap((track) => notesInRange(track, range));
  const activeRoles = roleSet(song, range);
  const foreground = playableTracks
    .filter((track) => ["melody", "counterpoint", "lead"].includes(String(track?.id ?? "")))
    .flatMap((track) => notesInRange(track, range));
  const meanVelocity = average(notes.map((note) => finite(note?.velocity, 84)), 84);
  const notesPerBeat = notes.length / Math.max(0.25, range.length);
  const foregroundShare = notes.length ? clamp(foreground.length / notes.length) : 0;
  const pressure = clamp(
    clamp(activeRoles.length / 7) * 0.34
    + clamp(notesPerBeat / 6) * 0.36
    + clamp(meanVelocity / 127) * 0.2
    + foregroundShare * 0.1,
  );
  return Object.freeze({
    sectionId: section?.id ?? null,
    name: section?.name ?? section?.type ?? section?.id ?? null,
    payoff: isPayoffSection(section),
    pressure: round(pressure),
    notesPerBeat: round(notesPerBeat),
    meanVelocity: round(meanVelocity, 2),
    activeRoles: Object.freeze(activeRoles),
    foregroundShare: round(foregroundShare),
  });
}

function setContinuity(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 1;
  const shared = [...union].filter((role) => leftSet.has(role) && rightSet.has(role)).length;
  return clamp(shared / union.size);
}

/**
 * Read-only macro ensemble pass.
 *
 * It checks section-to-section pressure, entrances/exits, continuity, and
 * payoff lift. It never changes note data.
 */
export function evaluateMacroEnsembleArc(song, { enabled = true } = {}) {
  const sections = Array.isArray(song?.structure) ? song.structure : [];
  const available = Boolean(enabled && sections.length >= 2 && Array.isArray(song?.tracks));
  if (!available) {
    return Object.freeze({
      version: 1,
      authority: "macro-ensemble-arc-v1",
      mode: "read-only",
      available: false,
      checks: Object.freeze({
        payoffLiftCoherent: true,
        transitionContinuityCoherent: true,
        entrancesExitsStaged: true,
      }),
      sectionPressure: Object.freeze([]),
      transitions: Object.freeze([]),
      payoffPairs: Object.freeze([]),
    });
  }

  const pressure = sections.map((section) => sectionPressure(song, section));
  const transitions = [];
  for (let index = 1; index < pressure.length; index += 1) {
    const previous = pressure[index - 1];
    const current = pressure[index];
    const previousRoles = previous.activeRoles;
    const currentRoles = current.activeRoles;
    const entrants = currentRoles.filter((role) => !previousRoles.includes(role));
    const exits = previousRoles.filter((role) => !currentRoles.includes(role));
    const continuity = setContinuity(previousRoles, currentRoles);
    const roleChanges = entrants.length + exits.length;
    const hardReset = previousRoles.length >= 3
      && currentRoles.length >= 3
      && continuity < 0.2;
    transitions.push(Object.freeze({
      fromSectionId: previous.sectionId,
      toSectionId: current.sectionId,
      pressureDelta: round(current.pressure - previous.pressure),
      velocityDelta: round(current.meanVelocity - previous.meanVelocity, 2),
      roleDelta: currentRoles.length - previousRoles.length,
      entrants: Object.freeze(entrants),
      exits: Object.freeze(exits),
      roleChanges,
      continuity: round(continuity),
      hardReset,
      staged: !hardReset && roleChanges <= 5,
    }));
  }

  const payoffPairs = pressure.flatMap((current, index) => {
    if (!current.payoff || index === 0 || pressure[index - 1]?.payoff) return [];
    const previous = pressure[index - 1];
    const pressureLift = current.pressure - previous.pressure;
    const roleLift = current.activeRoles.length - previous.activeRoles.length;
    const velocityLift = current.meanVelocity - previous.meanVelocity;
    const healthy = pressureLift >= 0.04 || roleLift >= 1 || velocityLift >= 4;
    return [Object.freeze({
      fromSectionId: previous.sectionId,
      toSectionId: current.sectionId,
      pressureLift: round(pressureLift),
      roleLift,
      velocityLift: round(velocityLift, 2),
      healthy,
    })];
  });

  const payoffLiftCoherent = payoffPairs.every((entry) => entry.healthy);
  const transitionContinuityCoherent = transitions.every((entry) => !entry.hardReset);
  const entrancesExitsStaged = transitions.every((entry) => entry.staged || entry.roleChanges <= 6);

  return Object.freeze({
    version: 1,
    authority: "macro-ensemble-arc-v1",
    mode: "read-only",
    available: true,
    checks: Object.freeze({
      payoffLiftCoherent,
      transitionContinuityCoherent,
      entrancesExitsStaged,
    }),
    sectionPressure: Object.freeze(pressure),
    transitions: Object.freeze(transitions),
    payoffPairs: Object.freeze(payoffPairs),
  });
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

  const directorGrooveDNASignature = specialistPlan?.grooveDNA
    ? signature(specialistPlan.grooveDNA)
    : grooveDNASignature;
  const specialistsShareGrooveDNA = !directorGrooveDNASignature
    || specialistGrooveSignatures.every((entry) => entry.signature === directorGrooveDNASignature);
  const sourceMatchesDirectorGrooveDNA = !grooveDNASignature
    || !directorGrooveDNASignature
    || grooveDNASignature === directorGrooveDNASignature;
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

  const sectionDiagnostics = Object.freeze((ensemble.sections ?? []).map((entry) => {
    const failures = [];
    if (Number(entry.rhythmFoundation ?? 1) < 0.45) failures.push("kick-bass");
    if (Number(entry.harmonicSupport ?? 1) < 0.5) failures.push("bass-harmony");
    if (Number(entry.leadHarmonySeparation ?? 1) < 0.5) failures.push("chord-melody");
    if (
      Number(entry.leadDialogue ?? 1) < 0.55
      || Number(entry.collisionControl ?? 1) < 0.5
    ) failures.push("melody-counterline");
    if (Number(entry.roleHierarchy ?? 1) < 0.55) failures.push("density-balance");
    if (Number(entry.cadenceTeam ?? 1) < 0.5) failures.push("transition-continuity");
    return Object.freeze({
      sectionId: entry.sectionId ?? null,
      score: Number(entry.score ?? 0),
      passed: failures.length === 0,
      failures: Object.freeze(failures),
      relationships: Object.freeze({
        kickBass: Number(entry.rhythmFoundation ?? 0),
        bassHarmony: Number(entry.harmonicSupport ?? 0),
        chordMelody: Number(entry.leadHarmonySeparation ?? 0),
        melodyCounterline: Number(entry.leadDialogue ?? 0),
        entranceExit: Number(entry.cadenceTeam ?? 0),
        densityBalance: Number(entry.roleHierarchy ?? 0),
        transitionContinuity: Number(entry.cadenceTeam ?? 0),
      }),
    });
  }));
  const sectionFailures = Object.freeze(sectionDiagnostics
    .filter((entry) => !entry.passed)
    .map((entry) => Object.freeze({
      sectionId: entry.sectionId,
      failures: entry.failures,
    })));

  const macroDiagnostics = evaluateMacroEnsembleArc(song, { enabled: ensembleAvailable });
  const macroPayoffLiftCoherent = !macroDiagnostics.available
    || macroDiagnostics.checks.payoffLiftCoherent === true;
  const macroTransitionContinuityCoherent = !macroDiagnostics.available
    || macroDiagnostics.checks.transitionContinuityCoherent === true;
  const macroEntrancesExitsStaged = !macroDiagnostics.available
    || macroDiagnostics.checks.entrancesExitsStaged === true;
  if (!macroPayoffLiftCoherent) issues.push("payoff-lift-weak");
  if (!macroTransitionContinuityCoherent) issues.push("section-transition-reset");

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
    macroPayoffLiftCoherent,
    macroTransitionContinuityCoherent,
    macroEntrancesExitsStaged,
  });
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedChecks / Object.keys(checks).length) * 100);

  return Object.freeze({
    version: 4,
    authority: "cross-authority-coherence-v4",
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
      directorGrooveDNA: directorGrooveDNASignature,
    }),
    observations: Object.freeze({
      sourceMatchesDirectorGrooveDNA,
    }),
    checks,
    grooveLock,
    ensemble,
    sectionDiagnostics,
    sectionFailures,
    macroDiagnostics,
    specialistSignatures: Object.freeze({
      grooveDNA: Object.freeze(specialistGrooveSignatures),
      harmony: Object.freeze(specialistHarmonySignatures),
      structure: Object.freeze(specialistSectionSignatures),
    }),
  });
}
