import { cloneValue } from "./clone-value.js";
import { evaluateMelodySectionMemory } from "./melody-section-memory.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

export const MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES = 3;

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
function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
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
  return { section, start, end };
}
function indexedNotes(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const track = melodyTrack(song);
  if (!range || !track) return [];
  return (track.notes ?? [])
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((left, right) => finite(left.note?.start) - finite(right.note?.start) || finite(left.note?.pitch) - finite(right.note?.pitch));
}
function scalePitchClasses(song) {
  const keyPc = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return null;
  return new Set(intervals.map((interval) => mod12(keyPc + Number(interval))));
}
function nearestPitchWithClass(reference, pitchClass, { min = 48, max = 84 } = {}) {
  const candidates = [];
  for (let pitch = min; pitch <= max; pitch += 1) {
    if (mod12(pitch) === mod12(pitchClass)) candidates.push(pitch);
  }
  return candidates.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference) || a - b)[0]
    ?? Math.round(clamp(reference, min, max));
}
function nearestScaleNeighbor(song, pitch, direction) {
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const scale = scalePitchClasses(song);
  const source = Math.round(finite(pitch, 60));
  if (!scale?.size) {
    const octave = source + (direction >= 0 ? 12 : -12);
    return octave >= window.min && octave <= window.max ? octave : source;
  }
  const candidates = [];
  for (let step = 1; step <= 7; step += 1) {
    const candidate = source + (direction >= 0 ? step : -step);
    if (candidate < window.min || candidate > window.max) continue;
    if (scale.has(mod12(candidate))) candidates.push(candidate);
  }
  return candidates[0] ?? source;
}
function sourceContract(song, sectionId) {
  return (song?.phraseMemory?.sections ?? []).find((entry) => String(entry?.sectionId) === String(sectionId)) ?? null;
}
function tag(note, sourceSectionId, role) {
  note.phraseMemorySourceSectionId = sourceSectionId;
  note.sectionDevelopmentRole = role;
}
function cloneBreakCandidate(song, report) {
  if (finite(report?.metrics?.cloneRisk) < 0.88) return null;
  const targetEntries = indexedNotes(song, report.sectionId);
  if (targetEntries.length < 4) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const positions = [
    Math.max(1, Math.floor(targetEntries.length / 3)),
    Math.min(targetEntries.length - 2, Math.floor((targetEntries.length * 2) / 3)),
  ];
  let changed = 0;
  positions.forEach((position, ordinal) => {
    const target = targetEntries[position];
    const note = track?.notes?.[target.index];
    if (!note) return;
    const direction = (position + ordinal + String(report.sectionId).length) % 2 === 0 ? 1 : -1;
    const nextPitch = nearestScaleNeighbor(candidate, note.pitch, direction);
    if (nextPitch === Math.round(finite(note.pitch))) return;
    note.pitch = nextPitch;
    note.velocity = Math.round(clamp(finite(note.velocity, 84) + (ordinal === 0 ? 2 : -2), 1, 120));
    tag(note, report.sourceSectionId, "developed-return");
    changed += 1;
  });
  return changed ? { id: "develop-clone", song: candidate, changedNotes: changed } : null;
}
function contourRecallCandidate(song, report) {
  if (finite(report?.metrics?.relationshipFit, 1) >= 0.72 && finite(report?.metrics?.familiarity, 1) >= 0.48) return null;
  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 3) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const count = Math.min(sourceEntries.length, targetEntries.length);
  const picks = [...Array(Math.max(0, count - 2)).keys()]
    .map((offset) => offset + 1)
    .sort((a, b) => {
      const sourceA = sourceEntries[Math.round(a * (sourceEntries.length - 1) / (count - 1))]?.note;
      const sourceB = sourceEntries[Math.round(b * (sourceEntries.length - 1) / (count - 1))]?.note;
      const targetA = targetEntries[Math.round(a * (targetEntries.length - 1) / (count - 1))]?.note;
      const targetB = targetEntries[Math.round(b * (targetEntries.length - 1) / (count - 1))]?.note;
      return Math.abs(finite(sourceB?.pitch) - finite(targetB?.pitch)) - Math.abs(finite(sourceA?.pitch) - finite(targetA?.pitch)) || a - b;
    })
    .slice(0, 2);
  let changed = 0;
  for (const position of picks) {
    const sourcePosition = Math.round(position * (sourceEntries.length - 1) / (count - 1));
    const targetPosition = Math.round(position * (targetEntries.length - 1) / (count - 1));
    const source = sourceEntries[sourcePosition]?.note;
    const target = targetEntries[targetPosition];
    const note = track?.notes?.[target?.index];
    if (!source || !note) continue;
    const nextPitch = nearestPitchWithClass(finite(note.pitch, 60), mod12(source.pitch), window);
    if (nextPitch === Math.round(finite(note.pitch))) continue;
    note.pitch = nextPitch;
    tag(note, report.sourceSectionId, "motif-recall-anchor");
    changed += 1;
  }
  return changed ? { id: "restore-contour", song: candidate, changedNotes: changed } : null;
}
function endingRecallCandidate(song, report) {
  if (finite(report?.metrics?.endingSimilarity, 1) >= 0.76) return null;
  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 2 || targetEntries.length < 2) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  let changed = 0;
  for (let tail = 2; tail >= 1; tail -= 1) {
    const source = sourceEntries[sourceEntries.length - tail]?.note;
    const target = targetEntries[targetEntries.length - tail];
    const note = track?.notes?.[target?.index];
    if (!source || !note) continue;
    const nextPitch = nearestPitchWithClass(finite(note.pitch, 60), mod12(source.pitch), window);
    const nextDuration = round(clamp(
      finite(note.duration, 0.5) * 0.55 + finite(source.duration, 0.5) * 0.45,
      0.12,
      1.5,
    ));
    if (nextPitch !== Math.round(finite(note.pitch)) || Math.abs(nextDuration - finite(note.duration, 0.5)) > 1e-6) changed += 1;
    note.pitch = nextPitch;
    note.duration = nextDuration;
    tag(note, report.sourceSectionId, tail === 1 ? "memory-landing" : "memory-approach");
  }
  return changed ? { id: "restore-ending", song: candidate, changedNotes: changed } : null;
}

/**
 * Tiny, deterministic repair set for the single weakest melody-memory relationship.
 * It never changes note topology, canonical start times, or non-melody tracks.
 */
export function createMelodySectionDevelopmentCandidates(song, {
  maxCandidates = MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES,
} = {}) {
  const before = evaluateMelodySectionMemory(song);
  const weakest = before?.weakestSection;
  if (!weakest?.available || before.status !== "evaluated" || before.passed) return [];
  const contract = sourceContract(song, weakest.sectionId);
  const report = {
    ...weakest,
    sourceSectionId: weakest.sourceSectionId ?? contract?.sourceSectionId ?? null,
  };
  if (!report.sourceSectionId) return [];
  const raw = [
    cloneBreakCandidate(song, report),
    contourRecallCandidate(song, report),
    endingRecallCandidate(song, report),
  ].filter(Boolean);
  const seen = new Set();
  return raw
    .slice(0, Math.max(0, Math.min(MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES, Math.floor(finite(maxCandidates, MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES)))))
    .map((candidate, candidateIndex) => {
      const after = evaluateMelodySectionMemory(candidate.song);
      const afterSection = (after.sections ?? []).find((entry) => String(entry.sectionId) === String(report.sectionId)) ?? null;
      const signature = JSON.stringify(melodyTrack(candidate.song)?.notes?.map((note) => [
        round(note.start), Math.round(finite(note.pitch)), round(note.duration), Math.round(finite(note.velocity, 84)),
      ]) ?? []);
      if (seen.has(signature)) return null;
      seen.add(signature);
      return {
        ...candidate,
        candidateIndex,
        sectionId: report.sectionId,
        sourceSectionId: report.sourceSectionId,
        relationship: report.relationship,
        beforeMemoryScore: before.score,
        afterMemoryScore: after.score,
        memoryScoreDelta: after.score - before.score,
        beforeSectionScore: finite(report.score),
        afterSectionScore: finite(afterSection?.score),
        sectionScoreDelta: finite(afterSection?.score) - finite(report.score),
        beforeReport: before,
        afterReport: after,
        beforeSection: report,
        afterSection,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.memoryScoreDelta > 0 && candidate.sectionScoreDelta > 0);
}
