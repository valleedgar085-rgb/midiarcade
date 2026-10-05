import { cloneValue } from "./clone-value.js";
import { grooveLaneForTrack, nearestGroovePulse } from "./groove-contract.js";
import { evaluateMusicalTimingLock } from "./musical-timing-lock.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, places = 6) {
  const power = 10 ** places;
  return Math.round((finite(value) + Number.EPSILON) * power) / power;
}

function drumLane(note = {}) {
  const source = String(note?.grooveSource ?? "");
  if (source.endsWith(".snare") || source.endsWith(".snare-layer")) return "snarePulses";
  if (source.endsWith(".hat")) return "hatPulses";
  if (source.endsWith(".percussion")) return "percussionPulses";
  return "anchors";
}

function laneFor(trackId, note) {
  return String(trackId) === "drums" ? drumLane(note) : grooveLaneForTrack(trackId);
}

function sectionBounds(song, beat) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  for (const section of song?.structure ?? []) {
    const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
    const endBeat = Math.max(
      startBeat + 0.25,
      finite(section?.endBeat, startBeat + Math.max(1, finite(section?.bars, 1)) * beatsPerBar),
    );
    if (beat >= startBeat - 1e-6 && beat < endBeat - 1e-6) return { startBeat, endBeat };
  }
  return null;
}

function structuralStart(note, performedStart) {
  if (note?.finalEnsembleRepairRole) return finite(note?.start, performedStart);
  return finite(note?.canonicalStartBeat, finite(note?.start, performedStart));
}

function violationWeight(report) {
  const metrics = report?.metrics ?? {};
  return (
    finite(metrics.outOfBounds) * 4
    + finite(metrics.performedSectionCrossings) * 4
    + finite(metrics.severePerformanceDrift) * 3
    + finite(metrics.grooveTimingViolations) * 2
  );
}

function repairPerformedNote(song, trackId, note, {
  grooveTolerance,
  severePerformanceDriftBeats,
  maxPocketDriftBeats,
}) {
  if (!note?.performed || typeof note.performed !== "object") return null;
  const performedStart = finite(note.performed.startBeat, finite(note.start, 0));
  const authoredStart = structuralStart(note, performedStart);
  const duration = Math.max(1 / 960, finite(note.performed.durationBeats, finite(note.duration, 0.25)));
  const totalBeats = Math.max(duration, finite(song?.meta?.totalBeats, authoredStart + duration));
  const authoredSection = sectionBounds(song, authoredStart);
  const performedSection = sectionBounds(song, performedStart);
  const crossedSection = Boolean(
    authoredSection
    && performedSection
    && (
      performedStart < authoredSection.startBeat - 1e-6
      || performedStart >= authoredSection.endBeat - 1e-6
    )
  );
  const drift = performedStart - authoredStart;
  const severeDrift = Math.abs(drift) > severePerformanceDriftBeats + 1e-9;

  let grooveDrift = false;
  if (note?.grooveSource || note?.grooveLane) {
    const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
    const canonicalPulse = nearestGroovePulse(
      song?.grooveConductor,
      laneFor(trackId, note),
      authoredStart,
      beatsPerBar,
      grooveTolerance,
    );
    const performedPulse = nearestGroovePulse(
      song?.grooveConductor,
      laneFor(trackId, note),
      performedStart,
      beatsPerBar,
      grooveTolerance,
    );
    const canonicalValid = canonicalPulse.distance != null && canonicalPulse.distance <= grooveTolerance + 1e-9;
    const performedInvalid = performedPulse.distance == null || performedPulse.distance > grooveTolerance + 1e-9;
    grooveDrift = canonicalValid && performedInvalid;
  }

  if (!crossedSection && !severeDrift && !grooveDrift) return null;

  let target = crossedSection
    ? authoredStart
    : authoredStart + clamp(drift, -maxPocketDriftBeats, maxPocketDriftBeats);
  if (grooveDrift) {
    target = authoredStart + clamp(target - authoredStart, -maxPocketDriftBeats, maxPocketDriftBeats);
  }
  const lowerBound = authoredSection?.startBeat ?? 0;
  const upperBound = Math.min(
    totalBeats - duration,
    authoredSection ? authoredSection.endBeat - Math.min(1 / 960, duration) : totalBeats - duration,
  );
  target = round(clamp(target, Math.max(0, lowerBound), Math.max(Math.max(0, lowerBound), upperBound)));
  if (Math.abs(target - performedStart) <= 1e-9) return null;

  const bpm = Math.max(1, finite(song?.meta?.tempo, finite(song?.meta?.bpm, finite(song?.tempo, 120))));
  const nextPerformed = {
    ...note.performed,
    startBeat: target,
    timingDeltaBeats: round(target - authoredStart),
    microtimingMs: round((target - authoredStart) * 60000 / bpm, 3),
  };

  return {
    startBeat: target,
    performed: nextPerformed,
    reason: crossedSection ? "section-boundary"
      : severeDrift ? "severe-performance-drift"
        : "groove-performance-drift",
  };
}

/**
 * Correct only finalized performance timing. Structural composition authority
 * remains untouched; no pitch, duration, velocity, topology, or harmony changes.
 */
export function applyMusicalTimingRepair(song, {
  grooveTolerance = 0.16,
  severePerformanceDriftBeats = 0.25,
  maxPocketDriftBeats = 0.08,
} = {}) {
  const before = evaluateMusicalTimingLock(song, {
    grooveTolerance,
    severePerformanceDriftBeats,
  });
  if (!song || !Array.isArray(song?.tracks) || before.status === "unavailable") {
    return Object.freeze({
      song,
      diagnostics: Object.freeze({
        version: 1,
        authority: "musical-timing-repair-v1",
        attempted: false,
        changed: false,
        accepted: false,
        reason: "timing-lock-unavailable",
        changedNotes: 0,
        changedTrackIds: Object.freeze([]),
        before,
        after: before,
      }),
    });
  }

  const candidate = cloneValue(song);
  let changedNotes = 0;
  const changedTrackIds = new Set();
  const reasons = {};

  for (const track of candidate.tracks) {
    const trackId = String(track?.id ?? "");
    for (const note of track?.notes ?? []) {
      const repaired = repairPerformedNote(candidate, trackId, note, {
        grooveTolerance,
        severePerformanceDriftBeats,
        maxPocketDriftBeats,
      });
      if (!repaired) continue;
      note.start = repaired.startBeat;
      note.performed = repaired.performed;
      note.musicalTimingRepairRole = repaired.reason;
      changedNotes += 1;
      changedTrackIds.add(trackId);
      reasons[repaired.reason] = (reasons[repaired.reason] ?? 0) + 1;
    }
    track.notes = [...(track.notes ?? [])].sort((left, right) => (
      finite(left?.start) - finite(right?.start)
      || finite(left?.pitch) - finite(right?.pitch)
    ));
  }

  if (!changedNotes) {
    return Object.freeze({
      song,
      diagnostics: Object.freeze({
        version: 1,
        authority: "musical-timing-repair-v1",
        attempted: false,
        changed: false,
        accepted: false,
        reason: before.passed ? "timing-already-locked" : "no-authorized-performance-repair",
        changedNotes: 0,
        changedTrackIds: Object.freeze([]),
        reasons: Object.freeze({}),
        before,
        after: before,
      }),
    });
  }

  const after = evaluateMusicalTimingLock(candidate, {
    grooveTolerance,
    severePerformanceDriftBeats,
  });
  const beforeWeight = violationWeight(before);
  const afterWeight = violationWeight(after);
  const improved = afterWeight < beforeWeight;
  const accepted = improved;

  return Object.freeze({
    song: accepted ? candidate : song,
    diagnostics: Object.freeze({
      version: 1,
      authority: "musical-timing-repair-v1",
      attempted: true,
      changed: accepted,
      accepted,
      reason: accepted ? "timing-violations-reduced" : "no-timing-improvement",
      changedNotes: accepted ? changedNotes : 0,
      changedTrackIds: Object.freeze(accepted ? [...changedTrackIds] : []),
      reasons: Object.freeze(accepted ? { ...reasons } : {}),
      beforeWeight,
      afterWeight,
      before,
      after,
      protectedMutations: Object.freeze(["timing"]),
    }),
  });
}
