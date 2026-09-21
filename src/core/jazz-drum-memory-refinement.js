import { cloneValue } from "./clone-value.js";
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round4 = (value) => Math.round((finite(value) + Number.EPSILON) * 1e4) / 1e4;
const round6 = (value) => Math.round((finite(value) + Number.EPSILON) * 1e6) / 1e6;
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
const JAZZ_SYNCOPATION_TARGET = 0.68;
const JAZZ_BACKBEATS = 2;
const JAZZ_BASS_LOCK_TARGET = 0.46;
const KICK_PITCHES = new Set([35, 36]);
const SNARE_PITCHES = new Set([37, 38, 39, 40]);

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function startOf(section) {
  return finite(section?.startBeat, finite(section?.start));
}

function endOf(section) {
  return finite(section?.endBeat, startOf(section) + finite(section?.bars) * 4);
}

function nameOf(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase().replace(/[^a-z]+/g, "");
}

function sectionPairs(song) {
  const sections = sectionsOf(song);
  const byId = new Map(sections.map((section) => [String(section.id), section]));
  const mapped = (Array.isArray(song?.memoryMap) ? song.memoryMap : [])
    .filter((entry) => ["recall", "return"].includes(String(entry?.relationship)))
    .map((entry) => ({ origin: byId.get(String(entry.originSectionId)), target: byId.get(String(entry.sectionId)) }))
    .filter(({ origin, target }) => origin && target && origin !== target);
  if (mapped.length) return mapped;
  const first = new Map();
  const fallback = [];
  for (const section of sections) {
    const name = nameOf(section);
    if (!first.has(name)) first.set(name, section);
    else fallback.push({ origin: first.get(name), target: section });
  }
  return fallback;
}

function notesForBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  return (song.tracks?.find((track) => track.id === "drums")?.notes ?? [])
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
}

function protectedNote(note) {
  const feature = String(note?.rhythmicFeature ?? "");
  return Boolean(note?.drumFillId || note?.transitionFeature || note?.transitionHandoffRole
    || note?.transitionHandoffId || feature.includes("fill") || feature.includes("roll"));
}

function protectedBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  if (bar <= 0 || bar >= bars - 1 || notesForBar(song, bar).some(protectedNote)) return true;
  return sectionsOf(song).some((section) => {
    const first = Math.floor(startOf(section) / barBeats + 1e-6);
    const last = Math.max(first, Math.ceil(endOf(section) / barBeats - 1e-6) - 1);
    return bar === first || bar === last;
  });
}

function drumSignature(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  return notesForBar(song, bar)
    .map((note) => `${note.pitch}:${round6(mod(finite(note.start), barBeats))}`)
    .join("|");
}

export function adjacentDrumDuplicateCount(song) {
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumSignature(song, bar)).filter(Boolean);
  return signatures.slice(1).filter((signature, index) => signature === signatures[index]).length;
}

function drumVarietyScore(song, drumNotes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumNotes
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => `${note.pitch}:${round4(mod(finite(note.start), barBeats))}`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return 58;
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  return clamp(Math.round(48 + clamp(usefulVariation, 0, 1) * 34 + (1 - adjacentCopies) * 18), 25, 100);
}

function onsetMatchRatio(notes, targets, offsets, tolerance = 0.075) {
  if (!notes.length || !targets.length) return 0;
  const matched = notes.filter((note) => targets.some((target) => offsets.some((offset) => (
    Math.abs(finite(note.start) - finite(target.start) - offset) <= tolerance
  )))).length;
  return matched / notes.length;
}

function jazzRhythmMetrics(song, drumNotes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
  const bass = song?.tracks?.find((track) => track.id === "bass")?.notes ?? [];
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const kicks = drumNotes.filter((note) => KICK_PITCHES.has(Number(note.pitch)));
  const snares = drumNotes.filter((note) => SNARE_PITCHES.has(Number(note.pitch)));
  const downbeatCoverage = kicks.length
    ? new Set(kicks
      .filter((note) => Math.abs(mod(finite(note.start), barBeats)) < 0.08)
      .map((note) => Math.floor(finite(note.start) / barBeats))).size / bars
    : 0;
  const backbeatCoverage = clamp(snares.length / Math.max(1, bars * JAZZ_BACKBEATS), 0, 1);
  const bassLock = onsetMatchRatio(bass, kicks, [0, 0.25, 0.5, 0.75], 0.075);
  const groove = clamp(Math.round(
    42 + downbeatCoverage * 16 + backbeatCoverage * 18 + bassLock * 24
  ), 25, 100);
  const rhythmicNotes = [...drumNotes, ...bass, ...melody];
  const measuredSyncopation = rhythmicNotes.length
    ? rhythmicNotes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length / rhythmicNotes.length
    : JAZZ_SYNCOPATION_TARGET;
  const syncopationFit = clamp(
    Math.round(100 - Math.abs(measuredSyncopation - JAZZ_SYNCOPATION_TARGET) * 135),
    25,
    100,
  );
  const bassLockFit = clamp(
    Math.round(bassLock / Math.max(0.1, JAZZ_BASS_LOCK_TARGET) * 100),
    25,
    100,
  );
  // Density and repetition are unchanged by this drum-only refinement, so this
  // is the complete mutable portion of Critic 6.0 genre authenticity.
  const authenticityRhythmTerm = syncopationFit * 0.25
    + backbeatCoverage * 100 * 0.15
    + bassLockFit * 0.2;
  return {
    groove,
    authenticityRhythmTerm,
    measuredSyncopation,
    syncopationFit,
    backbeatCoverage,
    bassLock,
    bassLockFit,
  };
}

function noteKey(note) {
  return [
    Number(note?.pitch),
    round6(finite(note?.start)),
    round6(finite(note?.duration, 0.25)),
  ].join(":");
}

function uniqueNotes(notes) {
  const seen = new Set();
  return notes.filter((note) => {
    const key = noteKey(note);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shiftedSourceNotes(sourceNotes, delta) {
  return sourceNotes.map((note) => ({
    ...cloneValue(note),
    start: round6(finite(note.start) + delta),
  }));
}

function targetSkeleton(notes) {
  return notes.filter((note) => KICK_PITCHES.has(Number(note.pitch)) || SNARE_PITCHES.has(Number(note.pitch)));
}

function sourceOrnaments(notes) {
  return notes.filter((note) => !KICK_PITCHES.has(Number(note.pitch)) && !SNARE_PITCHES.has(Number(note.pitch)));
}

function ornamentVariants(shifted, targetNotes) {
  const ornaments = sourceOrnaments(shifted)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const skeleton = targetSkeleton(targetNotes).map(cloneValue);
  const variants = [];

  // Full return-bar recall remains an option when it is already critic-safe.
  variants.push(uniqueNotes(shifted.map(cloneValue)));

  // The target bar's kick/snare skeleton carries its pocket and bass lock. Keep
  // that identity while recalling increasing amounts of the origin's hats and
  // ornaments. Prefixes are deterministic and give the critic several bounded
  // rhythmic densities to choose from without an unbounded candidate search.
  for (let count = 1; count <= ornaments.length; count += 1) {
    variants.push(uniqueNotes([
      ...skeleton.map(cloneValue),
      ...ornaments.slice(0, count).map(cloneValue),
    ]));
  }

  // Also audition ornaments ordered by offbeat relevance so the 0.68 Jazz
  // syncopation target can be preserved when chronological prefixes are too straight.
  const syncopated = [...ornaments].sort((left, right) => {
    const leftOffbeat = Math.abs(finite(left.start) - Math.round(finite(left.start))) > 0.08 ? 0 : 1;
    const rightOffbeat = Math.abs(finite(right.start) - Math.round(finite(right.start))) > 0.08 ? 0 : 1;
    return leftOffbeat - rightOffbeat || finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch);
  });
  for (let count = 1; count <= syncopated.length; count += 1) {
    variants.push(uniqueNotes([
      ...skeleton.map(cloneValue),
      ...syncopated.slice(0, count).map(cloneValue),
    ]));
  }

  const seen = new Set();
  return variants.filter((notes) => {
    const signature = notes.map(noteKey).sort().join("|");
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function candidateSong(sourceSong, targetNotes, replacementNotes) {
  const song = cloneValue(sourceSong);
  const targetDrums = song.tracks.find((track) => track.id === "drums");
  const targetKeys = new Set(targetNotes.map(noteKey));
  targetDrums.notes = targetDrums.notes
    .filter((note) => !targetKeys.has(noteKey(note)))
    .concat(replacementNotes.map(cloneValue))
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  return song;
}

export function createJazzDrumMemoryCandidate(sourceSong) {
  if (String(sourceSong?.genre ?? sourceSong?.meta?.genre ?? "") !== "jazz") return null;
  const drums = sourceSong?.tracks?.find((track) => track.id === "drums");
  if (!drums?.notes?.length) return null;

  const barBeats = finite(sourceSong?.meta?.beatsPerBar, 4);
  const sourceVariety = drumVarietyScore(sourceSong, drums.notes);
  const sourceRhythm = jazzRhythmMetrics(sourceSong, drums.notes);
  const adjacentBefore = adjacentDrumDuplicateCount(sourceSong);
  const candidates = [];

  for (const { origin, target } of sectionPairs(sourceSong)) {
    const originStart = Math.floor(startOf(origin) / barBeats + 1e-6);
    const targetStart = Math.floor(startOf(target) / barBeats + 1e-6);
    const span = Math.min(
      Math.max(0, Math.ceil((endOf(origin) - startOf(origin)) / barBeats)),
      Math.max(0, Math.ceil((endOf(target) - startOf(target)) / barBeats)),
    );
    for (let offset = 0; offset < span; offset += 1) {
      const sourceBar = originStart + offset;
      const targetBar = targetStart + offset;
      if (Math.abs(sourceBar - targetBar) <= 1
        || protectedBar(sourceSong, sourceBar)
        || protectedBar(sourceSong, targetBar)) continue;

      const sourceNotes = notesForBar(sourceSong, sourceBar);
      const targetNotes = notesForBar(sourceSong, targetBar);
      if (sourceNotes.length < 4 || targetNotes.length < 2) continue;
      const delta = (targetBar - sourceBar) * barBeats;
      const shifted = shiftedSourceNotes(sourceNotes, delta);

      for (const replacement of ornamentVariants(shifted, targetNotes)) {
        const song = candidateSong(sourceSong, targetNotes, replacement);
        const candidateDrums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
        const variety = drumVarietyScore(song, candidateDrums);
        if (variety < sourceVariety + 2) continue;
        const adjacentAfter = adjacentDrumDuplicateCount(song);
        if (adjacentAfter > adjacentBefore) continue;
        const rhythm = jazzRhythmMetrics(song, candidateDrums);
        if (rhythm.groove < sourceRhythm.groove) continue;
        if (rhythm.authenticityRhythmTerm + 1e-7 < sourceRhythm.authenticityRhythmTerm) continue;

        candidates.push({
          id: "jazz-return-groove-recall",
          song,
          changedBars: 1,
          sourceBar,
          targetBar,
          adjacentDuplicatesBefore: adjacentBefore,
          adjacentDuplicatesAfter: adjacentAfter,
          drumVarietyBefore: sourceVariety,
          drumVarietyAfter: variety,
          grooveBefore: sourceRhythm.groove,
          grooveAfter: rhythm.groove,
          authenticityRhythmBefore: round4(sourceRhythm.authenticityRhythmTerm),
          authenticityRhythmAfter: round4(rhythm.authenticityRhythmTerm),
          recalledNotes: replacement.length,
        });
      }
    }
  }

  candidates.sort((left, right) => (
    (right.drumVarietyAfter - left.drumVarietyAfter)
    || (right.grooveAfter - left.grooveAfter)
    || (right.authenticityRhythmAfter - left.authenticityRhythmAfter)
    || (left.recalledNotes - right.recalledNotes)
    || (left.sourceBar - right.sourceBar)
    || (left.targetBar - right.targetBar)
  ));
  return candidates.length ? Object.freeze(candidates[0]) : null;
}
