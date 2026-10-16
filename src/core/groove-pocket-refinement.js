import { cloneValue } from "./clone-value.js";
export const MAX_GROOVE_POCKET_CANDIDATES = 3;

const POCKET_PROFILES = Object.freeze([
  Object.freeze({ id: "tight-pocket", maxShift: 0.1, changesPerBar: 0.75 }),
  Object.freeze({ id: "balanced-pocket", maxShift: 0.15, changesPerBar: 1 }),
  Object.freeze({ id: "deep-pocket", maxShift: 0.2, changesPerBar: 1.25 }),
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function setNoteStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"].find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) ?? "start";
  note[key] = round(value);
}

function notePitch(note) {
  return Math.round(finite(note?.pitch ?? note?.note ?? note?.midi, 60));
}

function trackOf(song, id) {
  return song?.tracks?.find?.((track) => String(track?.id) === id) ?? null;
}

export function applyInstrumentMicroTiming(song, {
  laidBack = false,
} = {}) {
  const candidate = cloneValue(song);
  const beatsPerBar = Math.max(1, finite(candidate?.meta?.beatsPerBar, 4));
  if (!laidBack) return candidate;
  for (const track of candidate?.tracks ?? []) {
    const shift = track?.id === "drums" ? 0.025 : track?.id === "bass" ? 0.015 : 0;
    if (!shift) continue;
    track.notes = (track.notes ?? []).map((note) => {
      const current = noteStart(note);
      const barStart = Math.floor(current / beatsPerBar) * beatsPerBar;
      const barEnd = barStart + beatsPerBar - 0.001;
      const nextStart = round(Math.min(barEnd, current + shift), 4);
      return {
        ...note,
        start: nextStart,
        microTimingShiftBeats: round(nextStart - current, 4),
      };
    });
  }
  return candidate;
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function sectionStart(section) {
  return finite(section?.startBeat, 0);
}

function sectionEnd(section) {
  return finite(section?.endBeat, sectionStart(section));
}

function sectionForBeat(song, beat) {
  return sectionsOf(song).find((section) => beat >= sectionStart(section) - 1e-6 && beat < sectionEnd(section) - 1e-6) ?? null;
}

function grooveOffsets(genre) {
  if (genre === "house") return [0.5];
  if (["trap", "drill"].includes(genre)) return [0, 0.25];
  if (genre === "techno") return [0, 0.5];
  return [0, 0.25, 0.5, 0.75];
}

function kickNotes(song) {
  return (trackOf(song, "drums")?.notes ?? [])
    .filter((note) => [35, 36].includes(notePitch(note)))
    .sort((left, right) => noteStart(left) - noteStart(right));
}

function bassNotes(song) {
  return (trackOf(song, "bass")?.notes ?? [])
    .sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
}

function candidateTargets(song, kicks, offsets) {
  return kicks.flatMap((kick) => offsets.map((offset) => noteStart(kick) + offset))
    .filter((beat) => beat >= -1e-6 && beat < finite(song?.meta?.totalBeats, Infinity) - 0.02)
    .sort((left, right) => left - right);
}

function onsetMatchRatio(notes, targets, tolerance = 0.075) {
  if (!notes.length || !targets.length) return 0;
  const matched = notes.filter((note) => targets.some((target) => Math.abs(noteStart(note) - target) <= tolerance)).length;
  return matched / notes.length;
}

function hasBassCollision(notes, moving, desired) {
  return notes.some((note) => note !== moving && Math.abs(noteStart(note) - desired) < 0.03);
}

function createPocketCandidate(sourceSong, profile) {
  const song = cloneValue(sourceSong);
  const bass = bassNotes(song);
  const kicks = kickNotes(song);
  if (!bass.length || !kicks.length) return null;

  const offsets = grooveOffsets(String(song?.genre ?? song?.meta?.genre ?? "pop"));
  const targets = candidateTargets(song, kicks, offsets);
  if (!targets.length) return null;
  const beforeLock = onsetMatchRatio(bass, targets);
  const bars = Math.max(1, Math.ceil(finite(song?.bars, finite(song?.meta?.bars, finite(song?.meta?.totalBeats, 4) / Math.max(1, finite(song?.meta?.beatsPerBar, 4))))));
  const maxChanges = Math.min(32, Math.max(1, Math.ceil(bars * profile.changesPerBar)));

  const opportunities = [];
  for (const note of bass) {
    if (targets.some((target) => Math.abs(noteStart(note) - target) <= 0.075)) continue;
    const section = sectionForBeat(song, noteStart(note));
    if (!section) continue;
    const current = noteStart(note);
    const nearest = targets
      .filter((target) => target >= sectionStart(section) - 1e-6 && target < sectionEnd(section) - 0.02)
      .map((target) => ({ target, shift: Math.abs(target - current) }))
      .filter(({ shift }) => shift > 0.075 + 1e-6 && shift <= profile.maxShift + 1e-6)
      .sort((left, right) => left.shift - right.shift || left.target - right.target)[0];
    if (!nearest) continue;
    opportunities.push({ note, desired: nearest.target, shift: nearest.shift, sectionId: String(section.id ?? "") });
  }

  opportunities.sort((left, right) => left.shift - right.shift || noteStart(left.note) - noteStart(right.note));
  let changedNotes = 0;
  for (const opportunity of opportunities) {
    if (changedNotes >= maxChanges) break;
    if (hasBassCollision(bass, opportunity.note, opportunity.desired)) continue;
    setNoteStart(opportunity.note, opportunity.desired);
    opportunity.note.groovePocketRole = profile.id;
    opportunity.note.groovePocketSectionId = opportunity.sectionId;
    changedNotes += 1;
  }
  if (!changedNotes) return null;

  bass.sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));
  const afterLock = onsetMatchRatio(bass, targets);
  if (afterLock <= beforeLock + 1e-9) return null;

  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    groovePocket: {
      id: profile.id,
      changedNotes,
      maxShift: profile.maxShift,
      beforeLock: round(beforeLock),
      afterLock: round(afterLock),
      lockDelta: round(afterLock - beforeLock),
    },
  };

  return Object.freeze({
    id: profile.id,
    song,
    changedNotes,
    maxShift: profile.maxShift,
    beforeLock,
    afterLock,
    lockDelta: afterLock - beforeLock,
  });
}

function pocketSignature(candidate) {
  return (trackOf(candidate?.song, "bass")?.notes ?? [])
    .map((note) => `${round(noteStart(note), 4)}:${notePitch(note)}`)
    .join("|");
}

/**
 * Phase 6D groove refinement is intentionally bass-only. It auditions up to
 * three bounded timing strengths against the kick grid the critic already
 * understands. It never creates/deletes notes, changes pitch, rewrites drums,
 * or crosses section boundaries. The caller must still critic/release-gate it.
 */
export function createGroovePocketCandidates(sourceSong, config = {}) {
  if (config.groovePocketRefinement !== true) return [];
  const candidates = POCKET_PROFILES.map((profile) => createPocketCandidate(sourceSong, profile)).filter(Boolean);
  const seen = new Set();
  return candidates.filter((candidate) => {
    const signature = pocketSignature(candidate);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).slice(0, MAX_GROOVE_POCKET_CANDIDATES);
}


// Developer-only Bass Head candidate generator. The default groove-pocket
// authority and all existing selection/release contracts remain untouched.
const BASS_HEAD_BOUNCE_GENRES = new Set(["funk", "neoSoul"]);
const BASS_HEAD_MAX_CANDIDATES = 2;
const BASS_HEAD_MAX_SHIFT_BEATS = 0.25;
const bassHeadProtected = note => Boolean(
  note?.phraseAnchor || note?.motifMemoryCore || note?.ensembleCadenceRole
  || note?.motifHandoffRole || note?.transitionHandoffRole || note?.preserveTiming
  || note?.bassCadenceRole || note?.grooveAuthorityLock
  || note?.bassRegisterRole === "upper-harmonic"
);
const beatPhase = value => ((value % 1) + 1) % 1;
function harmonyIdentityAt(song, beat) {
  const harmonies = song?.harmony ?? [];
  if (!harmonies.length) return null;
  const chords = harmonies.filter(chord => noteStart(chord) <= beat + 1e-6);
  const active = chords.at(-1);
  return active ? [
    active.id ?? null, active.degree ?? null,
    active.root ?? active.rootPc ?? null, active.quality ?? active.type ?? null,
    active.start ?? null,
  ].join(":") : null;
}
function sectionAcceptsBounce(song, section) {
  if (!section || !/^(verse|chorus|idea|hook)/i.test(String(section.name ?? section.type ?? ""))) return false;
  const sectionId = String(section.id ?? "");
  const scene = song?.producerIntent?.scenes?.find(x => String(x.sectionId) === sectionId);
  if (scene?.roles?.bass === "rest") return false;
  const lane = song?.orchestrationMatrix
    ?.find(x => String(x.sectionId) === sectionId)?.lanes?.bass;
  return finite(lane?.presence, 1) >= 0.42;
}
function safeBassShift(song, notes, note, newStart, section, kicks, beatsPerBar) {
  const oldStart = noteStart(note);
  if (!Number.isFinite(newStart) || newStart < sectionStart(section) + 0.65
    || newStart >= sectionEnd(section) - 0.65
    || Math.abs(newStart - oldStart) > BASS_HEAD_MAX_SHIFT_BEATS + 1e-6
    || Math.floor((oldStart + 1e-6) / beatsPerBar) !== Math.floor((newStart + 1e-6) / beatsPerBar)
    || harmonyIdentityAt(song, oldStart) !== harmonyIdentityAt(song, newStart)
    || kicks.some(kick => Math.abs(noteStart(kick) - newStart) <= 0.075)) return false;
  const duration = Math.max(0, finite(note.duration, 0));
  for (const other of notes) {
    if (other === note) continue;
    const otherStart = noteStart(other);
    const otherEnd = otherStart + Math.max(0, finite(other.duration, 0));
    // This change must not create any extra overlap or unnaturally close
    // double-attacks when the original notes were intentionally separated.
    if (newStart < otherEnd + 0.02 && otherStart < newStart + duration + 0.02)
      return false;
  }
  return true;
}
function bassHeadOffbeatCount(notes) {
  return notes.filter(note => {
    const p = beatPhase(noteStart(note));
    return p > 0.075 && p < 0.925;
  }).length;
}
function createBassHeadBounceCandidate(sourceSong, direction) {
  const song = cloneValue(sourceSong);
  const bass = bassNotes(song), kicks = kickNotes(song);
  if (!bass.length || !kicks.length) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const bars = Math.max(1, finite(song?.meta?.bars, finite(song?.bars, 4)));
  const maxChanges = Math.min(8, Math.max(1, Math.ceil(bars / 2)));
  const beforeOffbeat = bassHeadOffbeatCount(bass);
  const candidates=[];
  for (const note of bass) {
    const oldStart = noteStart(note);
    const section = sectionForBeat(song, oldStart);
    if (!sectionAcceptsBounce(song, section) || bassHeadProtected(note)) continue;
    const phase = beatPhase(oldStart);
    if (Math.min(phase, 1 - phase) > 0.075) continue;
    // Preserve intended kick-locked hits, root accents and established
    // groove anchors. Only the interior, non-kick on-beat answer may move.
    if (kicks.some(kick => Math.abs(noteStart(kick) - oldStart) <= 0.075)) continue;
    const desired = round(oldStart + direction * BASS_HEAD_MAX_SHIFT_BEATS, 4);
    if (!safeBassShift(song, bass, note, desired, section, kicks, beatsPerBar)) continue;
    const twoBarGroup = Math.floor(oldStart / (2 * beatsPerBar));
    candidates.push({note,desired,sectionId:String(section.id ?? ""),twoBarGroup});
  }
  // Deterministic: no RNG, a maximum of one changed attack per two bars.
  const seenGroups = new Set();
  let changedNotes = 0;
  for (const candidate of candidates) {
    if (changedNotes >= maxChanges) break;
    if (seenGroups.has(candidate.twoBarGroup)) continue;
    if (!safeBassShift(song,bass,candidate.note,candidate.desired,
      sectionForBeat(song,noteStart(candidate.note)),kicks,beatsPerBar)) continue;
    seenGroups.add(candidate.twoBarGroup);
    setNoteStart(candidate.note,candidate.desired);
    candidate.note.bassHeadBounceRole = direction > 0 ? "kick-answer" : "pickup";
    candidate.note.bassHeadBounceSectionId = candidate.sectionId;
    changedNotes++;
  }
  if (!changedNotes) return null;
  bass.sort((a,b) => noteStart(a)-noteStart(b) || notePitch(a)-notePitch(b));
  const afterOffbeat = bassHeadOffbeatCount(bass);
  if (afterOffbeat <= beforeOffbeat) return null;
  const id = direction > 0 ? "bass-head-answer-quarter" : "bass-head-pickup-quarter";
  return Object.freeze({
    id,song,changedNotes,maxShiftBeats:BASS_HEAD_MAX_SHIFT_BEATS,
    beforeOffbeat,afterOffbeat,offbeatDelta:afterOffbeat-beforeOffbeat,
    gate:"shadow-only",
  });
}

/**
 * Evaluate only on a fixed-seed shadow branch or by explicit user intent.
 * Not called from generateNew(), normal postprocessing, or any APK runtime
 * pathway. Final MIDI export, release critic, and blind listening still decide
 * whether a musical change can be proposed for production.
 */
export function createBassHeadBounceCandidates(sourceSong,config={}) {
  if (config.bassHeadBounceV1 !== true) return [];
  const genre=String(sourceSong?.meta?.genre ?? sourceSong?.genre ?? "");
  if (!BASS_HEAD_BOUNCE_GENRES.has(genre) ||
    sourceSong?.meta?.secondaryGenre || sourceSong?.secondaryGenre) return [];
  return [1,-1].map(direction=>createBassHeadBounceCandidate(sourceSong,direction))
    .filter(Boolean).slice(0,BASS_HEAD_MAX_CANDIDATES);
}
