import {
  grooveBarPlan,
  grooveLaneForTrack,
  nearestGroovePulse,
} from "./groove-contract.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function protectedNote(note = {}) {
  return Boolean(
    note.phraseAnchor
    || note.resolutionRole
    || note.transitionRole
    || note.transitionFeature
    || note.transitionHandoffRole
    || note.memoryRole
    || note.motifHandoffRole
    || note.ensembleAccent
    || note.finalAssemblyRole
  );
}

function drumLane(note = {}) {
  const source = String(note.grooveSource ?? "");
  if (source.endsWith(".snare") || source.endsWith(".snare-layer")) return "snarePulses";
  if (source.endsWith(".hat")) return "hatPulses";
  if (source.endsWith(".percussion")) return "percussionPulses";
  return "anchors";
}

function laneFor(trackId, note) {
  return trackId === "drums" ? drumLane(note) : grooveLaneForTrack(trackId);
}

/**
 * Read-only final Groove DNA invariant check.
 *
 * This runs after all note-writing passes. It never moves a note; it reports
 * whether groove-authored events still agree with the conductor and whether
 * later stages wrote unprotected attacks into Groove DNA negative space.
 */
export function evaluateGrooveAuthorityLock(
  tracks = [],
  grooveConductor = null,
  { beatsPerBar = 4, timingTolerance = 0.16, protectedSpaceTolerance = 0.08 } = {},
) {
  const barBeats = Math.max(1, finite(beatsPerBar, 4));
  if (!Array.isArray(grooveConductor?.bars) || !grooveConductor.bars.length) {
    return Object.freeze({
      version: 1,
      status: "unavailable",
      authority: "groove-dna",
      repairs: 0,
      checkedNotes: 0,
      authoredNotes: 0,
      timingViolations: 0,
      protectedSpaceViolations: 0,
      adherence: null,
    });
  }

  let checkedNotes = 0;
  let authoredNotes = 0;
  let timingViolations = 0;
  let protectedSpaceViolations = 0;
  const byTrack = {};
  const byLane = {};

  for (const track of tracks ?? []) {
    const trackId = String(track?.id ?? "");
    let trackChecked = 0;
    let trackAuthored = 0;
    let trackTimingViolations = 0;
    let trackSpaceViolations = 0;

    for (const note of track?.notes ?? []) {
      const start = finite(note?.start, -1);
      if (start < 0) continue;
      checkedNotes += 1;
      trackChecked += 1;

      const lane = laneFor(trackId, note);
      const nearest = nearestGroovePulse(
        grooveConductor,
        lane,
        start,
        barBeats,
        timingTolerance,
      );
      const explicitlyAuthored = Boolean(note?.grooveSource || note?.grooveLane);
      if (explicitlyAuthored) {
        authoredNotes += 1;
        trackAuthored += 1;
        const laneReport = byLane[lane] ?? {
          authoredNotes: 0,
          timingViolations: 0,
        };
        laneReport.authoredNotes += 1;
        byLane[lane] = laneReport;
        if (nearest.distance == null || nearest.distance > timingTolerance + 1e-9) {
          timingViolations += 1;
          trackTimingViolations += 1;
          laneReport.timingViolations += 1;
        }
      }

      const bar = Math.max(0, Math.floor(start / barBeats));
      const plan = grooveBarPlan(grooveConductor, bar);
      const barStart = bar * barBeats;
      const localBeat = start - barStart;
      const violatesSpace = (plan?.protectedSpaces ?? []).some((space) => (
        Math.abs(finite(space) - localBeat) <= protectedSpaceTolerance
      ));
      if (violatesSpace && !protectedNote(note)) {
        protectedSpaceViolations += 1;
        trackSpaceViolations += 1;
      }
    }

    byTrack[trackId] = Object.freeze({
      checkedNotes: trackChecked,
      authoredNotes: trackAuthored,
      timingViolations: trackTimingViolations,
      protectedSpaceViolations: trackSpaceViolations,
    });
  }

  const adherence = authoredNotes
    ? Math.max(0, 1 - timingViolations / authoredNotes)
    : 1;
  const status = timingViolations === 0 && protectedSpaceViolations === 0
    ? "complete"
    : "best-available";
  const frozenByLane = Object.freeze(Object.fromEntries(
    Object.entries(byLane).map(([lane, report]) => [lane, Object.freeze({ ...report })]),
  ));
  const laneClean = (lane) => (byLane[lane]?.timingViolations ?? 0) === 0;
  const checks = Object.freeze({
    kickAnchors: laneClean("anchors"),
    snareAnchors: laneClean("snarePulses"),
    bassPulses: laneClean("bassPulses"),
    chordPulses: laneClean("chordPulses"),
    leadCounterRhythm: laneClean("leadPulses") && laneClean("counterPulses"),
    protectedNegativeSpace: protectedSpaceViolations === 0,
    postCompositionTimingStable: timingViolations === 0,
  });

  return Object.freeze({
    version: 2,
    status,
    authority: "groove-dna",
    repairs: 0,
    checkedNotes,
    authoredNotes,
    timingViolations,
    postCompositionTimingMutations: timingViolations,
    protectedSpaceViolations,
    adherence: round(adherence),
    timingTolerance: round(timingTolerance),
    protectedSpaceTolerance: round(protectedSpaceTolerance),
    checks,
    byLane: frozenByLane,
    byTrack: Object.freeze(byTrack),
  });
}
