function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function melodyTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}

function structure(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}

function sectionBounds(song, sectionId) {
  const section = structure(song).find((entry) => String(entry?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar ?? section?.start, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { section, start, end, length: Math.max(0.25, end - start), beatsPerBar };
}

function notesForSection(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const track = melodyTrack(song);
  if (!range || !track) return [];
  return (track.notes ?? [])
    .filter((note) => {
      const start = finite(note?.start);
      return start >= range.start - 1e-6 && start < range.end - 1e-6;
    })
    .sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
}

function directionSequence(notes) {
  return notes.slice(1).map((note, index) => Math.sign(
    finite(note?.pitch) - finite(notes[index]?.pitch),
  ));
}

function intervalSequence(notes) {
  return notes.slice(1).map((note, index) => Math.round(
    finite(note?.pitch) - finite(notes[index]?.pitch),
  ));
}

function rhythmSequence(notes, range) {
  if (notes.length < 2 || !range) return [];
  return notes.slice(1).map((note, index) => {
    const delta = Math.max(0, finite(note?.start) - finite(notes[index]?.start));
    return round(delta / range.length, 3);
  });
}

function normalizedPitchShape(notes) {
  if (!notes.length) return [];
  const base = finite(notes[0]?.pitch);
  return notes.map((note) => Math.round(finite(note?.pitch) - base));
}

function endingShape(notes) {
  if (!notes.length) return [];
  const tail = notes.slice(-Math.min(3, notes.length));
  const base = finite(tail[0]?.pitch);
  return tail.map((note) => Math.round(finite(note?.pitch) - base));
}

function ngrams(values, width = 2) {
  if (!values.length) return [];
  if (values.length < width) return [values.join(",")];
  const result = [];
  for (let index = 0; index <= values.length - width; index += 1) {
    result.push(values.slice(index, index + width).join(","));
  }
  return result;
}

function multisetSimilarity(leftValues, rightValues) {
  if (!leftValues.length && !rightValues.length) return 1;
  if (!leftValues.length || !rightValues.length) return 0;
  const left = new Map();
  const right = new Map();
  for (const value of leftValues) left.set(value, (left.get(value) ?? 0) + 1);
  for (const value of rightValues) right.set(value, (right.get(value) ?? 0) + 1);
  const keys = new Set([...left.keys(), ...right.keys()]);
  let intersection = 0;
  let union = 0;
  for (const key of keys) {
    const a = left.get(key) ?? 0;
    const b = right.get(key) ?? 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  return union ? intersection / union : 1;
}

function contourSimilarity(source, target) {
  const sourceDirections = directionSequence(source);
  const targetDirections = directionSequence(target);
  const directionScore = multisetSimilarity(ngrams(sourceDirections, 2), ngrams(targetDirections, 2));
  const sourceIntervals = intervalSequence(source).map((value) => Math.sign(value) * Math.min(7, Math.abs(value)));
  const targetIntervals = intervalSequence(target).map((value) => Math.sign(value) * Math.min(7, Math.abs(value)));
  const intervalScore = multisetSimilarity(ngrams(sourceIntervals, 2), ngrams(targetIntervals, 2));
  return clamp(directionScore * 0.62 + intervalScore * 0.38);
}

function rhythmSimilarity(source, target, sourceRange, targetRange) {
  const left = rhythmSequence(source, sourceRange).map((value) => Math.round(value * 32) / 32);
  const right = rhythmSequence(target, targetRange).map((value) => Math.round(value * 32) / 32);
  return clamp(multisetSimilarity(ngrams(left, 2), ngrams(right, 2)));
}

function endingSimilarity(source, target) {
  return clamp(multisetSimilarity(ngrams(endingShape(source), 2), ngrams(endingShape(target), 2)));
}

function exactCloneRisk(source, target, sourceRange, targetRange) {
  if (source.length < 2 || source.length !== target.length) return 0;
  const sourcePitch = normalizedPitchShape(source);
  const targetPitch = normalizedPitchShape(target);
  const sourceRhythm = rhythmSequence(source, sourceRange).map((value) => round(value, 4));
  const targetRhythm = rhythmSequence(target, targetRange).map((value) => round(value, 4));
  const sourceDurations = source.map((note) => round(finite(note?.duration, 0.25) / sourceRange.length, 4));
  const targetDurations = target.map((note) => round(finite(note?.duration, 0.25) / targetRange.length, 4));
  const exact = JSON.stringify(sourcePitch) === JSON.stringify(targetPitch)
    && JSON.stringify(sourceRhythm) === JSON.stringify(targetRhythm)
    && JSON.stringify(sourceDurations) === JSON.stringify(targetDurations);
  if (exact) return 1;
  const pitchMatch = sourcePitch.filter((value, index) => value === targetPitch[index]).length / sourcePitch.length;
  const rhythmMatch = sourceRhythm.filter((value, index) => Math.abs(value - targetRhythm[index]) <= 0.001).length / Math.max(1, sourceRhythm.length);
  return clamp(pitchMatch * 0.55 + rhythmMatch * 0.45);
}

function metadataCoverage(notes, sourceSectionId) {
  const tagged = notes.filter((note) => note?.phraseMemorySourceSectionId != null);
  if (!tagged.length) return { coverage: 0, accuracy: 1, tagged: 0 };
  const matching = tagged.filter((note) => String(note.phraseMemorySourceSectionId) === String(sourceSectionId)).length;
  return {
    coverage: tagged.length / Math.max(1, notes.length),
    accuracy: matching / tagged.length,
    tagged: tagged.length,
  };
}

function relationshipFitness({
  relationship,
  recallStrength,
  familiarity,
  cloneRisk,
  metadataAccuracy,
}) {
  const strength = clamp(recallStrength, 0, 1);
  let target;
  let tolerance;
  if (relationship === "return") {
    target = 0.62 + strength * 0.22;
    tolerance = 0.26;
  } else if (relationship === "recall") {
    target = 0.45 + strength * 0.24;
    tolerance = 0.32;
  } else {
    target = 0.3 + strength * 0.18;
    tolerance = 0.34;
  }
  const familiarityFit = clamp(1 - Math.abs(familiarity - target) / tolerance);
  const clonePenalty = relationship === "return"
    ? clamp((cloneRisk - 0.92) / 0.08)
    : clamp((cloneRisk - 0.82) / 0.18);
  const contrastPenalty = relationship === "contrast" && familiarity > 0.76
    ? clamp((familiarity - 0.76) / 0.24)
    : 0;
  return clamp(
    familiarityFit * 0.72
      + metadataAccuracy * 0.28
      - clonePenalty * 0.48
      - contrastPenalty * 0.35,
  );
}

/**
 * Read-only audit of whether final lead phrases honor the existing phrase-memory
 * contract. It compares the actual melody in recall/return/contrast sections
 * against the contract's source section and never changes MIDI.
 */
export function evaluateMelodySectionMemory(song) {
  const track = melodyTrack(song);
  const memorySections = song?.phraseMemory?.sections ?? [];
  if (!track) {
    return Object.freeze({
      version: 1,
      authority: "melody-section-memory-v1",
      mode: "read-only",
      status: "unavailable",
      passed: false,
      score: 0,
      reason: "missing-melody",
      sections: Object.freeze([]),
    });
  }

  const targets = memorySections.filter((memory) => (
    ["recall", "return", "contrast"].includes(String(memory?.relationship))
    && memory?.sourceSectionId != null
    && String(memory.sourceSectionId) !== String(memory.sectionId)
  ));

  const reports = targets.map((memory) => {
    const sourceRange = sectionBounds(song, memory.sourceSectionId);
    const targetRange = sectionBounds(song, memory.sectionId);
    const sourceNotes = notesForSection(song, memory.sourceSectionId);
    const targetNotes = notesForSection(song, memory.sectionId);
    if (!sourceRange || !targetRange || sourceNotes.length < 2 || targetNotes.length < 2) {
      return Object.freeze({
        sectionId: String(memory.sectionId),
        sourceSectionId: String(memory.sourceSectionId),
        relationship: String(memory.relationship),
        available: false,
        score: 0,
        reason: "missing-comparable-phrase",
      });
    }

    const contour = contourSimilarity(sourceNotes, targetNotes);
    const rhythm = rhythmSimilarity(sourceNotes, targetNotes, sourceRange, targetRange);
    const ending = endingSimilarity(sourceNotes, targetNotes);
    const familiarity = clamp(contour * 0.46 + rhythm * 0.34 + ending * 0.2);
    const cloneRisk = exactCloneRisk(sourceNotes, targetNotes, sourceRange, targetRange);
    const metadata = metadataCoverage(targetNotes, memory.sourceSectionId);
    const metadataAccuracy = metadata.tagged ? metadata.accuracy : 0.72;
    const relationshipFit = relationshipFitness({
      relationship: String(memory.relationship),
      recallStrength: finite(memory.recallStrength, 0.7),
      familiarity,
      cloneRisk,
      metadataAccuracy,
    });
    const score = Math.round(100 * (
      relationshipFit * 0.58
      + familiarity * 0.22
      + (1 - cloneRisk) * 0.12
      + metadataAccuracy * 0.08
    ));

    return Object.freeze({
      sectionId: String(memory.sectionId),
      sourceSectionId: String(memory.sourceSectionId),
      relationship: String(memory.relationship),
      transform: memory.transform ?? null,
      recallStrength: round(clamp(memory.recallStrength ?? 0.7)),
      available: true,
      score,
      metrics: Object.freeze({
        contourSimilarity: round(contour),
        rhythmSimilarity: round(rhythm),
        endingSimilarity: round(ending),
        familiarity: round(familiarity),
        cloneRisk: round(cloneRisk),
        relationshipFit: round(relationshipFit),
        metadataCoverage: round(metadata.coverage),
        metadataAccuracy: round(metadataAccuracy),
      }),
    });
  });

  const available = reports.filter((entry) => entry.available);
  if (!targets.length) {
    return Object.freeze({
      version: 1,
      authority: "melody-section-memory-v1",
      mode: "read-only",
      status: "unavailable",
      passed: true,
      score: 100,
      reason: "no-memory-comparisons",
      sections: Object.freeze([]),
    });
  }

  const score = Math.round(available.reduce((sum, entry) => sum + entry.score, 0) / Math.max(1, available.length));
  const cloneViolations = available.filter((entry) => entry.metrics.cloneRisk >= 0.92);
  const weak = available.filter((entry) => entry.metrics.relationshipFit < 0.48);
  const passed = available.length === targets.length && score >= 62 && cloneViolations.length === 0 && weak.length === 0;
  const weakestSection = [...available].sort((left, right) => left.score - right.score)[0] ?? null;

  return Object.freeze({
    version: 1,
    authority: "melody-section-memory-v1",
    mode: "read-only",
    status: available.length ? "evaluated" : "unavailable",
    passed,
    score,
    reason: available.length !== targets.length ? "incomplete-memory-comparison"
      : cloneViolations.length ? "memory-clone-risk"
        : weak.length ? "memory-relationship-weak"
          : score < 62 ? "memory-development-weak"
            : "memory-development-coherent",
    weakestSection,
    sections: Object.freeze(reports),
  });
}
