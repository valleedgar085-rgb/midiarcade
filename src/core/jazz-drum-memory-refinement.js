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

function syncopationDistance(notes, target = 0.68) {
  if (!notes.length) return Math.abs(target);
  const ratio = notes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length / notes.length;
  return Math.abs(ratio - target);
}

function drumVarietyScore(song, notes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => notes
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => `${note.pitch}:${round6(mod(finite(note.start), barBeats))}`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return 58;
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1).filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  return Math.round(48 + Math.max(0, Math.min(1, usefulVariation)) * 34 + (1 - adjacentCopies) * 18);
}

function rhythmAuthenticityScore(song, drumNotes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const bass = song?.tracks?.find((track) => track.id === "bass")?.notes ?? [];
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const snares = drumNotes.filter((note) => [37, 38, 39, 40].includes(note.pitch));
  const rhythmicNotes = [...drumNotes, ...bass, ...melody];
  const measured = rhythmicNotes.length
    ? rhythmicNotes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length / rhythmicNotes.length
    : 0.68;
  const syncFit = Math.max(25, Math.min(100, Math.round(100 - Math.abs(measured - 0.68) * 135)));
  const backbeat = Math.max(0, Math.min(1, snares.length / Math.max(1, bars * 2)));
  return syncFit * 0.25 + backbeat * 100 * 0.15;
}

export function adjacentDrumDuplicateCount(song) {
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumSignature(song, bar)).filter(Boolean);
  return signatures.slice(1).filter((signature, index) => signature === signatures[index]).length;
}

export function createJazzDrumMemoryCandidate(sourceSong) {
  if (String(sourceSong?.genre ?? sourceSong?.meta?.genre ?? "") !== "jazz") return null;
  const drums = sourceSong?.tracks?.find((track) => track.id === "drums");
  if (!drums?.notes?.length) return null;
  const song = cloneValue(sourceSong);
  const targetDrums = song.tracks.find((track) => track.id === "drums");
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  for (const { origin, target } of sectionPairs(song)) {
    const originStart = Math.floor(startOf(origin) / barBeats + 1e-6);
    const targetStart = Math.floor(startOf(target) / barBeats + 1e-6);
    const span = Math.min(
      Math.max(0, Math.ceil((endOf(origin) - startOf(origin)) / barBeats)),
      Math.max(0, Math.ceil((endOf(target) - startOf(target)) / barBeats)),
    );
    for (let offset = 0; offset < span; offset += 1) {
      const sourceBar = originStart + offset;
      const targetBar = targetStart + offset;
      if (Math.abs(sourceBar - targetBar) <= 1 || protectedBar(song, sourceBar) || protectedBar(song, targetBar)) continue;
      const sourceNotes = notesForBar(song, sourceBar);
      if (sourceNotes.length < 4) continue;
      const targetNotes = new Set(notesForBar(song, targetBar));
      const beforeDrumNotes = [...targetDrums.notes];
      const delta = (targetBar - sourceBar) * barBeats;
      targetDrums.notes = targetDrums.notes.filter((note) => !targetNotes.has(note));
      const recalled = sourceNotes.map((note) => ({ ...cloneValue(note), start: round6(finite(note.start) + delta) }));
      targetDrums.notes.push(...recalled);
      // Keep the memory recall musical, but preserve Jazz's syncopated identity
      // when a full-bar replacement moves the global groove away from target.
      const beforeDistance = syncopationDistance(beforeDrumNotes);
      const afterDistance = syncopationDistance(targetDrums.notes);
      if (afterDistance > beforeDistance) {
        const afterVariety = drumVarietyScore(song, targetDrums.notes);
        const afterRhythm = rhythmAuthenticityScore(song, targetDrums.notes);
        const bestAccent = [...targetNotes]
          .map((note) => {
            const candidateNotes = [...targetDrums.notes, note];
            return {
              note,
              distance: syncopationDistance(candidateNotes),
              variety: drumVarietyScore(song, candidateNotes),
              rhythm: rhythmAuthenticityScore(song, candidateNotes),
            };
          })
          .filter((candidate) => candidate.variety >= afterVariety && candidate.rhythm > afterRhythm)
          .sort((left, right) => right.rhythm - left.rhythm || left.distance - right.distance)[0];
        if (bestAccent) targetDrums.notes.push(bestAccent.note);
      }
      targetDrums.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
      return Object.freeze({
        id: "jazz-return-groove-recall",
        song,
        changedBars: 1,
        sourceBar,
        targetBar,
        adjacentDuplicatesBefore: adjacentDrumDuplicateCount(sourceSong),
        adjacentDuplicatesAfter: adjacentDrumDuplicateCount(song),
      });
    }
  }
  return null;
}
