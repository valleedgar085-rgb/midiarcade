import { cloneValue } from "./clone-value.js";
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round6 = (value) => Math.round((finite(value) + Number.EPSILON) * 1e6) / 1e6;
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

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

function sectionNameForBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const beat = bar * barBeats + barBeats / 2;
  const section = sectionsOf(song).find((entry) => beat >= startOf(entry) && beat < endOf(entry));
  return nameOf(section);
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

function kickNote(note) {
  return [35, 36].includes(Math.round(finite(note?.pitch)));
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

function bassKickLock(song) {
  const drums = song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
  const bass = song?.tracks?.find((track) => track.id === "bass")?.notes ?? [];
  const kicks = drums.filter(kickNote).map((note) => finite(note.start));
  if (!bass.length || !kicks.length) return 0;
  const offsets = [0, 0.25, 0.5, 0.75];
  const matched = bass.filter((note) => kicks.some((kick) => offsets.some((offset) => (
    Math.abs(finite(note.start) - kick - offset) <= 0.075
  )))).length;
  return matched / bass.length;
}

function authenticityRhythmScore(song) {
  const tracks = song?.tracks ?? [];
  const notes = ["drums", "bass", "melody"].flatMap((id) => (
    tracks.find((track) => track.id === id)?.notes ?? []
  ));
  const drums = tracks.find((track) => track.id === "drums")?.notes ?? [];
  const bars = Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
  const measuredSyncopation = notes.length
    ? notes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length / notes.length
    : 0.68;
  const syncopationFit = Math.max(25, Math.min(100, Math.round(100 - Math.abs(measuredSyncopation - 0.68) * 135)));
  const backbeatCoverage = Math.max(0, Math.min(1, drums.filter((note) => (
    [37, 38, 39, 40].includes(Math.round(finite(note.pitch)))
  )).length / Math.max(1, bars * 2)));
  const bassLockFit = Math.max(25, Math.min(100, Math.round(bassKickLock(song) / 0.46 * 100)));
  return syncopationFit * 0.25 + backbeatCoverage * 100 * 0.15 + bassLockFit * 0.2;
}

export function adjacentDrumDuplicateCount(song) {
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumSignature(song, bar)).filter(Boolean);
  return signatures.slice(1).filter((signature, index) => signature === signatures[index]).length;
}

function rhythmProfile(song) {
  const notes = song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
  const kicks = notes.filter((note) => [35, 36].includes(Math.round(finite(note.pitch))));
  const snares = notes.filter((note) => [37, 38, 39, 40].includes(Math.round(finite(note.pitch))));
  const syncopated = notes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08);
  return {
    kickRatio: kicks.length / Math.max(1, notes.length),
    snareRatio: snares.length / Math.max(1, notes.length),
    syncopationRatio: syncopated.length / Math.max(1, notes.length),
  };
}

function rhythmProfileDrift(source, candidate) {
  const before = rhythmProfile(source);
  const after = rhythmProfile(candidate);
  return Math.abs(after.syncopationRatio - before.syncopationRatio) * 2
    + Math.abs(after.kickRatio - before.kickRatio)
    + Math.abs(after.snareRatio - before.snareRatio);
}

export function createJazzDrumMemoryCandidate(sourceSong) {
  if (String(sourceSong?.genre ?? sourceSong?.meta?.genre ?? "") !== "jazz") return null;
  const drums = sourceSong?.tracks?.find((track) => track.id === "drums");
  if (!drums?.notes?.length) return null;
  const barBeats = finite(sourceSong?.meta?.beatsPerBar, 4);
  const totalBars = Math.max(1, Math.round(finite(sourceSong?.meta?.bars, sourceSong?.bars ?? 1)));
  const beforeBassLock = bassKickLock(sourceSong);
  const beforeAuthenticityRhythm = authenticityRhythmScore(sourceSong);
  const candidates = [];
  for (const { origin, target } of sectionPairs(sourceSong)) {
    const originStart = Math.floor(startOf(origin) / barBeats + 1e-6);
    const targetStart = Math.floor(startOf(target) / barBeats + 1e-6);
    const span = Math.min(
      Math.max(0, Math.ceil((endOf(origin) - startOf(origin)) / barBeats)),
      Math.max(0, Math.ceil((endOf(target) - startOf(target)) / barBeats)),
    );
    for (let offset = 0; offset < span; offset += 1) {
      const targetBar = targetStart + offset;
      if (protectedBar(sourceSong, targetBar)) continue;
      const preferredSourceBar = originStart + offset;
      const sourceBars = [preferredSourceBar, ...Array.from({ length: totalBars }, (_, bar) => bar)]
        .filter((bar, index, values) => values.indexOf(bar) === index && bar < targetStart - 1);
      for (const sourceBar of sourceBars) {
        if (Math.abs(sourceBar - targetBar) <= 1 || ["intro", "outro"].includes(sectionNameForBar(sourceSong, sourceBar))) continue;
        const sourceNotes = notesForBar(sourceSong, sourceBar);
        if (sourceNotes.length < 4) continue;
        const song = cloneValue(sourceSong);
        const targetDrums = song.tracks.find((track) => track.id === "drums");
        const targetNotes = new Set(notesForBar(song, targetBar));
        const delta = (targetBar - sourceBar) * barBeats;
        targetDrums.notes = targetDrums.notes.filter((note) => !targetNotes.has(note));
        targetDrums.notes.push(...sourceNotes.map((note) => ({ ...cloneValue(note), start: round6(finite(note.start) + delta) })));
        targetDrums.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
        candidates.push({
          id: "jazz-return-groove-recall",
          song,
          changedBars: 1,
          sourceBar,
          targetBar,
          preferredSource: sourceBar === preferredSourceBar,
          bassLockDelta: bassKickLock(song) - beforeBassLock,
          authenticityRhythmDelta: authenticityRhythmScore(song) - beforeAuthenticityRhythm,
          rhythmProfileDrift: rhythmProfileDrift(sourceSong, song),
          adjacentDuplicatesBefore: adjacentDrumDuplicateCount(sourceSong),
          adjacentDuplicatesAfter: adjacentDrumDuplicateCount(song),
        });
      }
    }
  }
  const selected = candidates
    .filter((candidate) => candidate.adjacentDuplicatesAfter <= candidate.adjacentDuplicatesBefore
      && candidate.bassLockDelta >= -1e-9
      && candidate.authenticityRhythmDelta >= -1e-9)
    .sort((left, right) => left.rhythmProfileDrift - right.rhythmProfileDrift
      || Number(right.preferredSource) - Number(left.preferredSource)
      || left.sourceBar - right.sourceBar
      || left.targetBar - right.targetBar)[0];
  if (!selected) return null;
  return Object.freeze({
    id: selected.id,
    song: selected.song,
    changedBars: selected.changedBars,
    sourceBar: selected.sourceBar,
    targetBar: selected.targetBar,
    adjacentDuplicatesBefore: selected.adjacentDuplicatesBefore,
    adjacentDuplicatesAfter: selected.adjacentDuplicatesAfter,
  });
}
