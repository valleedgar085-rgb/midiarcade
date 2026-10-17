/**
 * Read-only, note-level evidence for a returning chorus.
 * Reuses the established recurrence critic's section pairing, windowBars and
 * 12-note comparison limit. This is not another hook critic or repair owner.
 */
const MAX_NOTES = 12;
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function sectionBounds(song, section) {
  const beatsPerBar = Math.max(1, numeric(song?.meta?.beatsPerBar, 4));
  const start = numeric(section?.startBeat, numeric(section?.startBar, 0) * beatsPerBar);
  const end = Math.max(start, numeric(section?.endBeat,
    start + Math.max(1, numeric(section?.bars, 4)) * beatsPerBar));
  return { start, end, beatsPerBar };
}

function openingNotes(song, section, windowBars) {
  const { start, end, beatsPerBar } = sectionBounds(song, section);
  const cutoff = Math.min(end, start + beatsPerBar * windowBars);
  const melody = (song?.tracks ?? []).find(track => track?.id === "melody");
  if (!melody || !Array.isArray(melody.notes)) return [];
  return melody.notes
    .filter(note => Number.isFinite(Number(note?.start)) && Number.isFinite(Number(note?.pitch)))
    .filter(note => numeric(note.start) >= start - 1e-6 && numeric(note.start) < cutoff - 1e-6)
    .slice()
    .sort((a, b) => numeric(a.start) - numeric(b.start) || numeric(a.pitch) - numeric(b.pitch))
    .slice(0, MAX_NOTES)
    .map(note => ({
      onset: numeric(note.start) - start,
      pitch: numeric(note.pitch),
      duration: numeric(note.duration, 0.25),
      velocity: Number.isFinite(Number(note.velocity)) ? Number(note.velocity) : null,
      phraseMemorySourceSectionId: note.phraseMemorySourceSectionId == null
        ? null : String(note.phraseMemorySourceSectionId),
      sectionDevelopmentRole: note.sectionDevelopmentRole ?? null,
      hookDevelopmentRole: note.hookDevelopmentRole ?? null,
    }));
}

const unavailable = (reason, windowBars = null) => ({
  status: "unavailable",
  reason,
  windowBars,
  source: [],
  returning: [],
  indexAlignedDifferences: [],
  provenance: { matched: 0, mismatched: 0, absent: 0, mismatchedIndices: [] },
  metrics: null,
  primaryWeakness: null,
  stageAttribution: "unavailable-from-final-notes",
});

/**
 * Compare the *rendered* first and returning chorus. Metadata tags describe
 * surviving provenance only; absent tags are not failed authority assertions.
 * The index-aligned deltas are observations, not inferred note correspondences
 * for phrases with different pickups or note counts.
 */
export function inspectHookNoteEvidence(song, sourceSectionId, returnSectionId, comparison) {
  if (!comparison) return unavailable("missing-recurrence-comparison");
  const windowBars = comparison.windowBars === 4 ? 4 : 2;
  if (!comparison.available) return unavailable("insufficient-opening-notes", windowBars);
  const sections = Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
  const sourceSection = sections.find(section => String(section?.id) === String(sourceSectionId));
  const returnSection = sections.find(section => String(section?.id) === String(returnSectionId));
  if (!sourceSection || !returnSection) return unavailable("missing-section", windowBars);
  const source = openingNotes(song, sourceSection, windowBars);
  const returning = openingNotes(song, returnSection, windowBars);
  if (source.length < 4 || returning.length < 4) return unavailable("insufficient-opening-notes", windowBars);

  const mismatchedIndices = [];
  let matched = 0;
  let absent = 0;
  for (const [index, note] of returning.entries()) {
    if (note.phraseMemorySourceSectionId === null) absent += 1;
    else if (note.phraseMemorySourceSectionId === String(sourceSectionId)) matched += 1;
    else mismatchedIndices.push(index);
  }
  const metrics = {
    score: comparison.score,
    contour: comparison.contour,
    interval: comparison.interval,
    rhythm: comparison.rhythm,
    duration: comparison.duration,
    noteCoverage: comparison.noteCoverage,
    sourceOnsetCoverage: comparison.sourceOnsetCoverage,
    returnOnsetCoverage: comparison.returnOnsetCoverage,
    extraPickup: comparison.extraPickup,
    missingTail: comparison.missingTail,
  };
  const dimensions = ["contour", "interval", "rhythm", "duration", "noteCoverage"];
  const primaryWeakness = comparison.score < 0.66
    ? dimensions.filter(key => Number.isFinite(metrics[key]))
      .sort((a, b) => metrics[a] - metrics[b] || a.localeCompare(b))[0] ?? null
    : null;
  return {
    status: "evaluated",
    reason: comparison.score < 0.66 ? "weak-rendered-hook" : "recognizable-rendered-hook",
    windowBars,
    source,
    returning,
    indexAlignedDifferences: Array.from({ length: Math.min(source.length, returning.length) }, (_, i) => ({
      index: i,
      relativeOnsetDelta: returning[i].onset - source[i].onset,
      semitoneDelta: returning[i].pitch - source[i].pitch,
      durationDelta: returning[i].duration - source[i].duration,
    })),
    provenance: {
      matched,
      mismatched: mismatchedIndices.length,
      absent,
      mismatchedIndices,
    },
    metrics,
    primaryWeakness,
    stageAttribution: "unavailable-from-final-notes",
  };
}
