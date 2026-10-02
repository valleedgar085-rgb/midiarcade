import { cloneValue } from "./clone-value.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";
import { resolveFinalEnsembleRepairPlan } from "./generation-repair-router.js";
import { auditStageMutationAuthority } from "./mutation-authority.js";
import { trackGroovePulses } from "./groove-contract.js";

export const MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES = 3;
const SUPPORT_TRACKS = Object.freeze(["pad", "arp", "counterpoint", "chords"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function sectionFor(song, sectionId) {
  return (song?.structure ?? []).find((section) => String(section?.id ?? "") === String(sectionId ?? "")) ?? null;
}

function sectionBounds(song, sectionId) {
  const section = sectionFor(song, sectionId);
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { section, sectionId: section?.id ?? sectionId, startBeat, endBeat, beatsPerBar };
}

function track(song, trackId) {
  return (song?.tracks ?? []).find((entry) => String(entry?.id ?? "") === String(trackId ?? "")) ?? null;
}

function noteStart(note) {
  return finite(note?.start, -1);
}

function noteEnd(note) {
  return noteStart(note) + Math.max(0.04, finite(note?.duration, 0.25));
}

function notesInBounds(trackObject, bounds) {
  return (trackObject?.notes ?? []).filter((note) => (
    noteStart(note) >= bounds.startBeat - 1e-6
    && noteStart(note) < bounds.endBeat - 1e-6
  ));
}

function overlaps(left, right, tolerance = 0.04) {
  return noteStart(left) < noteEnd(right) - tolerance
    && noteEnd(left) > noteStart(right) + tolerance;
}

function protectedNote(note) {
  const semantic = [
    note?.id,
    note?.role,
    note?.phraseRole,
    note?.continuityRole,
    note?.grooveRole,
    note?.semanticRole,
    note?.eventRole,
  ].filter(Boolean).join(":").toLowerCase();
  return /(answer|fill|pickup|cadence|turnaround|memory|continuity)/.test(semantic);
}

function sortTrack(trackObject) {
  trackObject.notes = [...(trackObject?.notes ?? [])]
    .sort((left, right) => noteStart(left) - noteStart(right) || finite(left?.pitch) - finite(right?.pitch));
}

function removeOneSupportNote(song, sectionId) {
  const bounds = sectionBounds(song, sectionId);
  if (!bounds) return null;
  const melodyNotes = [
    ...notesInBounds(track(song, "melody"), bounds),
    ...notesInBounds(track(song, "lead"), bounds),
  ];
  const counterNotes = notesInBounds(track(song, "counterpoint"), bounds);
  const foreground = [...melodyNotes, ...counterNotes];

  const choices = [];
  for (const trackId of SUPPORT_TRACKS) {
    const trackObject = track(song, trackId);
    if (!trackObject) continue;
    for (const note of notesInBounds(trackObject, bounds)) {
      if (protectedNote(note)) continue;
      const collisionCount = foreground.filter((foregroundNote) => overlaps(note, foregroundNote, 0.02)).length;
      choices.push({ trackId, note, collisionCount });
    }
  }
  if (!choices.length) return null;
  choices.sort((left, right) => (
    right.collisionCount - left.collisionCount
    || SUPPORT_TRACKS.indexOf(left.trackId) - SUPPORT_TRACKS.indexOf(right.trackId)
    || noteStart(left.note) - noteStart(right.note)
  ));
  const selected = choices[0];
  const candidate = cloneValue(song);
  const candidateTrack = track(candidate, selected.trackId);
  const index = (candidateTrack?.notes ?? []).findIndex((note) => (
    noteStart(note) === noteStart(selected.note)
    && finite(note?.pitch) === finite(selected.note?.pitch)
    && finite(note?.duration) === finite(selected.note?.duration)
    && String(note?.id ?? "") === String(selected.note?.id ?? "")
  ));
  if (index < 0) return null;
  candidateTrack.notes.splice(index, 1);
  return {
    song: candidate,
    changedNotes: 1,
    changedTrackIds: [selected.trackId],
    operation: "subtract-support-note",
  };
}

function restoreLeadDialogue(song, sectionId) {
  const bounds = sectionBounds(song, sectionId);
  if (!bounds) return null;
  const melody = notesInBounds(track(song, "melody"), bounds);
  const counter = notesInBounds(track(song, "counterpoint"), bounds);
  if (!melody.length || !counter.length) return null;

  const collisions = counter
    .filter((note) => !protectedNote(note))
    .map((note) => ({
      note,
      calls: melody.filter((call) => overlaps(note, call, 0.02)),
    }))
    .filter((entry) => entry.calls.length)
    .sort((left, right) => right.calls.length - left.calls.length || noteStart(left.note) - noteStart(right.note));
  if (!collisions.length) return null;

  const selected = collisions[0];
  const call = [...selected.calls].sort((left, right) => noteEnd(right) - noteEnd(left))[0];
  const desired = Math.ceil((noteEnd(call) + 0.06) * 4) / 4;
  const maxStart = bounds.endBeat - Math.max(0.12, finite(selected.note?.duration, 0.25));
  const nextStart = round(clamp(desired, bounds.startBeat, maxStart), 4);
  const shift = nextStart - noteStart(selected.note);
  if (shift < 0.08 || shift > 1) return null;

  const candidate = cloneValue(song);
  const candidateTrack = track(candidate, "counterpoint");
  const candidateNote = (candidateTrack?.notes ?? []).find((note) => (
    noteStart(note) === noteStart(selected.note)
    && finite(note?.pitch) === finite(selected.note?.pitch)
    && finite(note?.duration) === finite(selected.note?.duration)
    && String(note?.id ?? "") === String(selected.note?.id ?? "")
  ));
  if (!candidateNote) return null;
  candidateNote.start = nextStart;
  candidateNote.finalEnsembleRepairRole = "lead-dialogue-answer";
  sortTrack(candidateTrack);
  return {
    song: candidate,
    changedNotes: 1,
    changedTrackIds: ["counterpoint"],
    operation: "restore-call-response",
  };
}

function shortenSupportSustain(song, sectionId, foundationTrackId = "melody") {
  const bounds = sectionBounds(song, sectionId);
  if (!bounds) return null;
  const foundation = notesInBounds(track(song, foundationTrackId), bounds);
  const chords = notesInBounds(track(song, "chords"), bounds);
  if (!foundation.length || !chords.length) return null;

  const candidates = [];
  for (const target of foundation) {
    const sustaining = chords.filter((note) => (
      noteStart(note) < noteStart(target) - 0.08
      && noteEnd(note) > noteStart(target) + 0.08
      && !protectedNote(note)
    ));
    if (!sustaining.length) continue;
    const grouped = sustaining.filter((note) => Math.abs(noteStart(note) - noteStart(sustaining[0])) <= 0.01);
    const newDuration = round(noteStart(target) - noteStart(sustaining[0]) - 0.04, 4);
    if (newDuration < 0.12) continue;
    candidates.push({ target, grouped, newDuration });
  }
  if (!candidates.length) return null;
  candidates.sort((left, right) => noteStart(left.target) - noteStart(right.target));
  const selected = candidates[0];

  const candidate = cloneValue(song);
  const candidateTrack = track(candidate, "chords");
  let changedNotes = 0;
  for (const original of selected.grouped) {
    const note = (candidateTrack?.notes ?? []).find((entry) => (
      noteStart(entry) === noteStart(original)
      && finite(entry?.pitch) === finite(original?.pitch)
      && finite(entry?.duration) === finite(original?.duration)
      && String(entry?.id ?? "") === String(original?.id ?? "")
    ));
    if (!note) continue;
    note.duration = Math.min(finite(note.duration, 0.25), selected.newDuration);
    note.finalEnsembleRepairRole = "support-yield";
    changedNotes += 1;
  }
  if (!changedNotes) return null;
  return {
    song: candidate,
    changedNotes,
    changedTrackIds: ["chords"],
    operation: "shorten-support-sustain",
  };
}

function relockBassToGroove(song, sectionId) {
  const bounds = sectionBounds(song, sectionId);
  if (!bounds) return null;
  const bassTrack = track(song, "bass");
  const bass = notesInBounds(bassTrack, bounds).filter((note) => !protectedNote(note));
  if (!bass.length) return null;
  const pulses = trackGroovePulses(
    song?.grooveConductor,
    "bass",
    bounds.startBeat,
    bounds.endBeat,
    bounds.beatsPerBar,
  );
  if (!pulses.length) return null;

  const moves = bass.map((note) => {
    const nearest = [...pulses].sort((left, right) => (
      Math.abs(left - noteStart(note)) - Math.abs(right - noteStart(note)) || left - right
    ))[0];
    return { note, nearest, shift: nearest - noteStart(note) };
  }).filter(({ shift }) => Math.abs(shift) >= 0.04 && Math.abs(shift) <= 0.14)
    .sort((left, right) => Math.abs(right.shift) - Math.abs(left.shift));
  if (!moves.length) return null;

  const selected = moves[0];
  const candidate = cloneValue(song);
  const candidateTrack = track(candidate, "bass");
  const candidateNote = (candidateTrack?.notes ?? []).find((note) => (
    noteStart(note) === noteStart(selected.note)
    && finite(note?.pitch) === finite(selected.note?.pitch)
    && finite(note?.duration) === finite(selected.note?.duration)
    && String(note?.id ?? "") === String(selected.note?.id ?? "")
  ));
  if (!candidateNote) return null;
  candidateNote.start = round(selected.nearest, 4);
  candidateNote.finalEnsembleRepairRole = "groove-relock";
  sortTrack(candidateTrack);
  return {
    song: candidate,
    changedNotes: 1,
    changedTrackIds: ["bass"],
    operation: "relock-bass-to-groove",
  };
}

function staggerEntrance(song, sectionId) {
  const bounds = sectionBounds(song, sectionId);
  if (!bounds) return null;
  const candidates = SUPPORT_TRACKS.flatMap((trackId) => (
    notesInBounds(track(song, trackId), bounds)
      .filter((note) => !protectedNote(note) && noteStart(note) <= bounds.startBeat + 0.26)
      .map((note) => ({ trackId, note }))
  ));
  if (!candidates.length) return null;
  candidates.sort((left, right) => (
    SUPPORT_TRACKS.indexOf(left.trackId) - SUPPORT_TRACKS.indexOf(right.trackId)
    || noteStart(left.note) - noteStart(right.note)
  ));
  const selected = candidates[0];
  const nextStart = round(Math.min(bounds.endBeat - 0.12, noteStart(selected.note) + 0.25), 4);
  if (nextStart <= noteStart(selected.note) + 0.04) return null;

  const candidate = cloneValue(song);
  const candidateTrack = track(candidate, selected.trackId);
  const candidateNote = (candidateTrack?.notes ?? []).find((note) => (
    noteStart(note) === noteStart(selected.note)
    && finite(note?.pitch) === finite(selected.note?.pitch)
    && finite(note?.duration) === finite(selected.note?.duration)
    && String(note?.id ?? "") === String(selected.note?.id ?? "")
  ));
  if (!candidateNote) return null;
  candidateNote.start = nextStart;
  candidateNote.duration = round(Math.min(
    finite(candidateNote.duration, 0.25),
    Math.max(0.12, bounds.endBeat - nextStart),
  ), 4);
  candidateNote.finalEnsembleRepairRole = "staggered-entry";
  sortTrack(candidateTrack);
  return {
    song: candidate,
    changedNotes: 1,
    changedTrackIds: [selected.trackId],
    operation: "stagger-support-entry",
  };
}

function preserveTransitionCarrier(song, fromSectionId, toSectionId) {
  const fromBounds = sectionBounds(song, fromSectionId);
  const toBounds = sectionBounds(song, toSectionId);
  if (!fromBounds || !toBounds) return null;
  const trackIds = ["pad", "chords", "arp"];
  for (const trackId of trackIds) {
    const source = notesInBounds(track(song, trackId), fromBounds)
      .filter((note) => !protectedNote(note))
      .sort((left, right) => noteEnd(right) - noteEnd(left))[0];
    if (!source) continue;
    const gap = toBounds.startBeat - noteEnd(source);
    if (gap < -0.05 || gap > 0.5) continue;
    const newDuration = round(
      Math.min(
        finite(source.duration, 0.25) + Math.max(0.12, gap + 0.18),
        finite(source.duration, 0.25) + 0.65,
      ),
      4,
    );
    const candidate = cloneValue(song);
    const candidateTrack = track(candidate, trackId);
    const candidateNote = (candidateTrack?.notes ?? []).find((note) => (
      noteStart(note) === noteStart(source)
      && finite(note?.pitch) === finite(source?.pitch)
      && finite(note?.duration) === finite(source?.duration)
      && String(note?.id ?? "") === String(source?.id ?? "")
    ));
    if (!candidateNote) continue;
    candidateNote.duration = newDuration;
    candidateNote.finalEnsembleRepairRole = "transition-carrier";
    return {
      song: candidate,
      changedNotes: 1,
      changedTrackIds: [trackId],
      operation: "preserve-transition-carrier",
    };
  }
  return null;
}

function repairForDirective(song, directive) {
  const relationship = String(directive?.relationship ?? "");
  if (relationship === "density-balance") return removeOneSupportNote(song, directive?.sectionId);
  if (relationship === "melody-counterline") return restoreLeadDialogue(song, directive?.sectionId);
  if (relationship === "chord-melody") return shortenSupportSustain(song, directive?.sectionId, "melody");
  if (relationship === "bass-harmony") return shortenSupportSustain(song, directive?.sectionId, "bass");
  if (relationship === "kick-bass") return relockBassToGroove(song, directive?.sectionId);
  if (relationship === "entrance-exit") return staggerEntrance(song, directive?.sectionId);
  if (relationship === "transition-continuity") {
    return preserveTransitionCarrier(song, directive?.fromSectionId, directive?.sectionId);
  }
  if (relationship === "payoff-lift") return removeOneSupportNote(song, directive?.fromSectionId);
  return null;
}

function issueCount(report) {
  const sectionFailures = (report?.sectionFailures ?? [])
    .reduce((sum, entry) => sum + (entry?.failures?.length ?? 0), 0);
  const payoffFailures = (report?.macroDiagnostics?.payoffPairs ?? [])
    .filter((entry) => entry?.healthy === false).length;
  const transitionFailures = (report?.macroDiagnostics?.transitions ?? [])
    .filter((entry) => entry?.hardReset === true || entry?.staged === false).length;
  return (report?.issues?.length ?? 0) + sectionFailures + payoffFailures + transitionFailures;
}

function protectedDeltas(before, after) {
  const dimensions = new Set([
    ...Object.keys(before?.subscores ?? {}),
    ...Object.keys(after?.subscores ?? {}),
  ]);
  return Object.fromEntries([...dimensions].map((dimension) => [
    dimension,
    finite(after?.subscores?.[dimension]) - finite(before?.subscores?.[dimension]),
  ]));
}

function assessCandidate(candidate, song, beforeReport, beforeEvaluation, evaluateCandidate, evaluateReleaseGate) {
  const afterReport = evaluateCrossAuthorityCoherence(candidate.song);
  const afterEvaluation = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, afterEvaluation);
  const mutationAuthority = auditStageMutationAuthority(song, candidate.song, "finalEnsembleRefinement");
  const scoreDelta = finite(afterEvaluation?.score) - finite(beforeEvaluation?.score);
  const floorDelta = creativeFloor(afterEvaluation) - creativeFloor(beforeEvaluation);
  const deltas = protectedDeltas(beforeEvaluation, afterEvaluation);
  const protectedSafe = Object.values(deltas).every((delta) => delta >= -1e-9);
  const scaleSafe = finite(afterEvaluation?.diagnostics?.scaleFit, 0) >= 0.999999;
  const beforeIssues = issueCount(beforeReport);
  const afterIssues = issueCount(afterReport);
  const issueDelta = afterIssues - beforeIssues;
  const newIssues = (afterReport?.issues ?? []).filter((issue) => !(beforeReport?.issues ?? []).includes(issue));
  const improved = issueDelta < 0 || finite(afterReport?.score) > finite(beforeReport?.score);
  const accepted = Boolean(
    mutationAuthority.passed
    && release?.passed
    && scaleSafe
    && improved
    && newIssues.length === 0
    && scoreDelta >= -1e-9
    && floorDelta >= -1e-9
    && protectedSafe
  );
  return {
    ...candidate,
    afterReport,
    afterEvaluation,
    release,
    mutationAuthority,
    scoreDelta,
    floorDelta,
    protectedDeltas: deltas,
    protectedSafe,
    beforeIssues,
    afterIssues,
    issueDelta,
    newIssues,
    accepted,
    reason: !mutationAuthority.passed ? "mutation-authority-violation"
      : !release?.passed ? "release-gate"
        : !scaleSafe ? "scale-safety"
          : !improved ? "ensemble-direction"
            : newIssues.length ? "new-ensemble-regression"
              : !protectedSafe ? "protected-dimension-regression"
                : scoreDelta < -1e-9 || floorDelta < -1e-9 ? "critic-regression"
                  : "final-ensemble-win",
  };
}

function compareAssessments(left, right) {
  if (left.issueDelta !== right.issueDelta) return left.issueDelta - right.issueDelta;
  const reportDelta = finite(right.afterReport?.score) - finite(left.afterReport?.score);
  if (Math.abs(reportDelta) > 1e-9) return reportDelta;
  if (Math.abs(right.scoreDelta - left.scoreDelta) > 1e-9) return right.scoreDelta - left.scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

export function createFinalEnsembleRepairCandidates(song, {
  report = evaluateCrossAuthorityCoherence(song),
  plan = resolveFinalEnsembleRepairPlan(report, { maxDirectives: 2 }),
  maxCandidates = MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES,
} = {}) {
  if (!plan?.available || !Array.isArray(plan?.directives) || !plan.directives.length) return [];
  const limit = Math.max(1, Math.min(MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES, Math.floor(maxCandidates)));
  const candidates = [];

  for (const directive of plan.directives) {
    const repaired = repairForDirective(song, directive);
    if (!repaired) continue;
    candidates.push({
      ...repaired,
      id: `final-ensemble:${directive.relationship}:${directive.sectionId ?? "unknown"}`,
      directive,
      candidateIndex: candidates.length,
    });
    if (candidates.length >= limit) break;
  }

  if (candidates.length >= 2 && candidates.length < limit) {
    const first = repairForDirective(song, plan.directives[0]);
    const combined = first ? repairForDirective(first.song, plan.directives[1]) : null;
    if (combined) {
      candidates.push({
        ...combined,
        id: "final-ensemble:combined",
        directive: Object.freeze({
          relationship: "combined",
          sectionId: plan.directives[1]?.sectionId ?? plan.directives[0]?.sectionId ?? null,
        }),
        candidateIndex: candidates.length,
        changedNotes: finite(first.changedNotes) + finite(combined.changedNotes),
        changedTrackIds: [...new Set([...(first.changedTrackIds ?? []), ...(combined.changedTrackIds ?? [])])],
        operation: `${first.operation}+${combined.operation}`,
      });
    }
  }

  return candidates;
}

export function applyFinalEnsembleRefinement(
  song,
  {
    evaluateCandidate,
    evaluateReleaseGate,
    report = evaluateCrossAuthorityCoherence(song),
    plan = resolveFinalEnsembleRepairPlan(report, { maxDirectives: 2 }),
  } = {},
) {
  if (typeof evaluateCandidate !== "function" || typeof evaluateReleaseGate !== "function") {
    throw new TypeError("final ensemble refinement requires candidate and release evaluators");
  }
  if (!plan?.available) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: false,
        accepted: false,
        changed: false,
        reason: "final-ensemble-coherent",
        candidateLimit: MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES,
        candidatesEvaluated: 0,
        candidateIds: Object.freeze([]),
        plan,
        beforeReport: report,
      }),
    };
  }

  const candidates = createFinalEnsembleRepairCandidates(song, { report, plan });
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-safe-bounded-repair",
        candidateLimit: MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES,
        candidatesEvaluated: 0,
        candidateIds: Object.freeze([]),
        plan,
        beforeReport: report,
      }),
    };
  }

  const beforeEvaluation = evaluateCandidate(song);
  const assessments = candidates.map((candidate) => assessCandidate(
    candidate,
    song,
    report,
    beforeEvaluation,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const accepted = assessments.filter((entry) => entry.accepted).sort(compareAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareAssessments)[0];
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: Boolean(selected?.accepted),
    changed: Boolean(selected?.accepted),
    reason: selected?.reason ?? "no-safe-bounded-repair",
    id: selected?.id ?? null,
    relationship: selected?.directive?.relationship ?? null,
    sectionId: selected?.directive?.sectionId ?? null,
    operation: selected?.operation ?? null,
    changedNotes: finite(selected?.changedNotes),
    changedTrackIds: Object.freeze([...(selected?.changedTrackIds ?? [])]),
    candidateLimit: MAX_FINAL_ENSEMBLE_REPAIR_CANDIDATES,
    candidatesEvaluated: assessments.length,
    candidateIds: Object.freeze(assessments.map((entry) => entry.id)),
    beforeIssueCount: issueCount(report),
    afterIssueCount: selected?.afterIssues ?? issueCount(report),
    issueDelta: selected?.issueDelta ?? 0,
    beforeScore: finite(beforeEvaluation?.score),
    afterScore: finite(selected?.afterEvaluation?.score, finite(beforeEvaluation?.score)),
    scoreDelta: finite(selected?.scoreDelta),
    floorDelta: finite(selected?.floorDelta),
    protectedDeltas: Object.freeze({ ...(selected?.protectedDeltas ?? {}) }),
    mutationAuthority: selected?.mutationAuthority ?? null,
    plan,
    beforeReport: report,
    afterReport: selected?.afterReport ?? report,
    candidateSummaries: Object.freeze(assessments.map((entry) => Object.freeze({
      id: entry.id,
      relationship: entry.directive?.relationship ?? null,
      accepted: Boolean(entry.accepted),
      reason: entry.reason,
      operation: entry.operation,
      changedNotes: finite(entry.changedNotes),
      issueDelta: entry.issueDelta,
      scoreDelta: round(entry.scoreDelta, 4),
      floorDelta: round(entry.floorDelta, 4),
    }))),
  });

  return {
    song: selected?.accepted ? selected.song : song,
    diagnostics,
  };
}
