import { grooveLaneForTrack, nearestGroovePulse } from "./groove-contract.js";
import { resolvePerformedNote } from "./performed-note-contract.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 4) {
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

function sectionRange(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const startBeat = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(1, finite(section?.bars, 1));
  const endBeat = Math.max(startBeat + 0.25, finite(section?.endBeat, startBeat + bars * beatsPerBar));
  return { id: String(section?.id ?? ""), startBeat, endBeat };
}

function sectionIdAtBeat(ranges, beat, totalBeats) {
  const target = finite(beat, -1);
  if (target < 0 || target > totalBeats + 1e-6) return null;
  const exactEnd = Math.abs(target - totalBeats) <= 1e-6;
  const match = ranges.find((range, index) => (
    target >= range.startBeat - 1e-6
    && (target < range.endBeat - 1e-6 || (exactEnd && index === ranges.length - 1))
  ));
  return match?.id ?? null;
}

function nearestDistance(value, values = []) {
  if (!values.length) return null;
  return values.reduce((best, candidate) => (
    Math.abs(candidate - value) < best ? Math.abs(candidate - value) : best
  ), Infinity);
}

/**
 * Final read-only timing authority.
 *
 * This runs after composition/performance passes and evaluates the exact
 * performed beat positions consumed by both preview and MIDI export. It never
 * moves notes. Phase 5 uses it as the measurement authority before any
 * deterministic timing repair is allowed.
 */
export function evaluateMusicalTimingLock(
  song,
  {
    grooveTolerance = 0.16,
    severePerformanceDriftBeats = 0.25,
    kickBassConnectionBeats = 0.75,
  } = {},
) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  const totalBeats = Math.max(0, finite(song?.meta?.totalBeats, 0));
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const structure = Array.isArray(song?.structure) ? song.structure : [];
  const grooveAvailable = Array.isArray(song?.grooveConductor?.bars) && song.grooveConductor.bars.length > 0;

  if (!tracks.length || !(totalBeats > 0)) {
    return Object.freeze({
      version: 1,
      authority: "musical-timing-lock-v1",
      mode: "read-only",
      status: "unavailable",
      passed: false,
      repairs: 0,
      checkedNotes: 0,
      checks: Object.freeze({}),
      metrics: Object.freeze({}),
      byTrack: Object.freeze({}),
    });
  }

  const ranges = structure.map((section) => sectionRange(song, section));
  const kickStarts = tracks
    .find((track) => String(track?.id ?? "") === "drums")
    ?.notes?.filter((note) => [35, 36].includes(Math.round(finite(resolvePerformedNote(note).pitch, -1))))
    .map((note) => resolvePerformedNote(note).start)
    .filter(Number.isFinite) ?? [];

  let checkedNotes = 0;
  let outOfBounds = 0;
  let authoredNotes = 0;
  let grooveTimingViolations = 0;
  let finalizedNotes = 0;
  let severePerformanceDrift = 0;
  let performedSectionCrossings = 0;
  const byTrack = {};
  const bassKickDistances = [];

  for (const track of tracks) {
    const trackId = String(track?.id ?? "");
    const report = {
      checkedNotes: 0,
      authoredNotes: 0,
      grooveTimingViolations: 0,
      finalizedNotes: 0,
      severePerformanceDrift: 0,
      performedSectionCrossings: 0,
    };

    for (const note of track?.notes ?? []) {
      const performed = resolvePerformedNote(note);
      const start = finite(performed.start, -1);
      const duration = Math.max(0, finite(performed.duration, 0));
      const end = start + duration;
      const authoredStart = finite(
        note?.finalEnsembleRepairRole ? note?.start : note?.canonicalStartBeat,
        finite(note?.start, start),
      );
      checkedNotes += 1;
      report.checkedNotes += 1;

      if (start < -1e-6 || duration <= 0 || end > totalBeats + 1e-6) {
        outOfBounds += 1;
      }

      const explicitlyGrooveAuthored = Boolean(note?.grooveSource || note?.grooveLane);
      if (explicitlyGrooveAuthored && grooveAvailable) {
        authoredNotes += 1;
        report.authoredNotes += 1;
        const nearest = nearestGroovePulse(
          song.grooveConductor,
          laneFor(trackId, note),
          start,
          beatsPerBar,
          grooveTolerance,
        );
        if (nearest.distance == null || nearest.distance > grooveTolerance + 1e-9) {
          grooveTimingViolations += 1;
          report.grooveTimingViolations += 1;
        }
      }

      if (performed.finalized) {
        finalizedNotes += 1;
        report.finalizedNotes += 1;
        const drift = Math.abs(start - authoredStart);
        if (drift > severePerformanceDriftBeats + 1e-9) {
          severePerformanceDrift += 1;
          report.severePerformanceDrift += 1;
        }

        if (ranges.length) {
          const authoredSection = sectionIdAtBeat(ranges, authoredStart, totalBeats);
          const performedSection = sectionIdAtBeat(ranges, start, totalBeats);
          if (authoredSection && performedSection && authoredSection !== performedSection) {
            performedSectionCrossings += 1;
            report.performedSectionCrossings += 1;
          }
        }
      }

      if (trackId === "bass" && kickStarts.length) {
        const distance = nearestDistance(start, kickStarts);
        if (distance != null) bassKickDistances.push(distance);
      }
    }

    byTrack[trackId] = Object.freeze(report);
  }

  const connectedBassNotes = bassKickDistances.filter((distance) => distance <= kickBassConnectionBeats + 1e-9).length;
  const directBassLocks = bassKickDistances.filter((distance) => distance <= 0.08 + 1e-9).length;
  const kickBassConnection = bassKickDistances.length
    ? connectedBassNotes / bassKickDistances.length
    : 1;
  const directKickBassLock = bassKickDistances.length
    ? directBassLocks / bassKickDistances.length
    : 0;

  const grooveAdherence = authoredNotes
    ? Math.max(0, 1 - grooveTimingViolations / authoredNotes)
    : 1;
  const finalizedStability = finalizedNotes
    ? Math.max(0, 1 - (severePerformanceDrift + performedSectionCrossings) / finalizedNotes)
    : 1;

  const checks = Object.freeze({
    finalBeatBounds: outOfBounds === 0,
    grooveAuthoredTimingStable: grooveTimingViolations === 0,
    performedSectionStable: performedSectionCrossings === 0,
    noSeverePerformanceDrift: severePerformanceDrift === 0,
  });
  const passed = Object.values(checks).every(Boolean);

  return Object.freeze({
    version: 1,
    authority: "musical-timing-lock-v1",
    mode: "read-only",
    status: passed ? "complete" : "best-available",
    passed,
    repairs: 0,
    checkedNotes,
    authoredNotes,
    finalizedNotes,
    grooveTolerance: round(grooveTolerance),
    severePerformanceDriftBeats: round(severePerformanceDriftBeats),
    checks,
    metrics: Object.freeze({
      outOfBounds,
      grooveTimingViolations,
      performedSectionCrossings,
      severePerformanceDrift,
      grooveAdherence: round(grooveAdherence),
      finalizedStability: round(finalizedStability),
      kickBassConnection: round(clamp(kickBassConnection)),
      directKickBassLock: round(clamp(directKickBassLock)),
    }),
    byTrack: Object.freeze(byTrack),
  });
}
