import { cloneValue } from "./clone-value.js";
import { evaluateMelodyPhraseIntelligence } from "./melody-phrase-intelligence.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";
import { trackGroovePulses } from "./groove-contract.js";

export const MAX_MELODY_PHRASE_CANDIDATES = 3;
export const MAX_PHRASE_PLACEMENT_MOVED_NOTES = 8;
export const MAX_PHRASE_PLACEMENT_SHIFT_BEATS = 0.5;
export const MIN_PHRASE_CONVERSATION_SCORE = 0.72;
export const MAX_PHRASE_CONVERSATION_PITCH_EDITS = 3;
export const MIN_MELODIC_ARC_PAYOFF_SCORE = 0.7;
export const MAX_MELODIC_ARC_PITCH_EDITS = 2;

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
function sections(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}
function sectionBounds(song, sectionId) {
  const section = sections(song).find((entry) => String(entry?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { section, start, end, beatsPerBar };
}
function notesInSection(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const track = melodyTrack(song);
  if (!range || !track) return [];
  return (track.notes ?? [])
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((a, b) => finite(a.note?.start) - finite(b.note?.start) || finite(a.note?.pitch) - finite(b.note?.pitch));
}
function harmonyAt(song, beat) {
  let result = song?.harmony?.[0] ?? null;
  for (const event of song?.harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat);
    const duration = Math.max(0.01, finite(event?.duration ?? event?.durationBeats, 0.25));
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) return event;
  }
  return result;
}
function chordPitchClasses(event) {
  if (Array.isArray(event?.tones) && event.tones.length) return [...new Set(event.tones.map(mod12))];
  if (Number.isFinite(Number(event?.rootPc))) return [mod12(event.rootPc)];
  return [];
}
function scalePitchClasses(song) {
  const keyPc = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return null;
  return new Set(intervals.map((interval) => mod12(keyPc + Number(interval))));
}
function nearestPitchWithClass(sourcePitch, classes, { min = 48, max = 84 } = {}) {
  if (!classes?.length) return Math.round(clamp(sourcePitch, min, max));
  const source = Math.round(finite(sourcePitch, 60));
  const candidates = [];
  for (let pitch = min; pitch <= max; pitch += 1) {
    if (classes.includes(mod12(pitch))) candidates.push(pitch);
  }
  return candidates.sort((a, b) => Math.abs(a - source) - Math.abs(b - source) || a - b)[0] ?? source;
}
function sectionLandingCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (!entries.length) return null;
  const candidate = cloneValue(song);
  const target = entries.at(-1);
  const note = melodyTrack(candidate)?.notes?.[target.index];
  if (!note) return null;
  const chord = harmonyAt(candidate, finite(note.start));
  let classes = chordPitchClasses(chord);
  const scale = scalePitchClasses(candidate);
  if (scale?.size) classes = classes.filter((pc) => scale.has(pc));
  if (!classes.length && scale?.size) classes = [...scale];
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const beforePitch = Math.round(finite(note.pitch, 60));
  const afterPitch = nearestPitchWithClass(beforePitch, classes, window);
  note.pitch = afterPitch;
  note.duration = round(clamp(finite(note.duration, 0.5) * 1.16, 0.24, 1.5));
  note.velocity = Math.round(clamp(finite(note.velocity, 84) + 5, 1, 120));
  note.phraseIntentRole = "cadential-landing";
  return { id: "cadential-landing", song: candidate, changedNotes: 1 };
}
function protectedPhraseAnchor(note) {
  return Boolean(
    note?.phraseAnchor
    || note?.resolutionRole
    || note?.ensembleCadenceRole
    || note?.transitionRole
    || note?.transitionFeature
    || note?.transitionHandoffRole
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
  );
}

function phrasePlacementProtected(note) {
  const rhythmicFeature = String(note?.rhythmicFeature ?? "");
  return Boolean(
    protectedPhraseAnchor(note)
    || note?.memoryRole
    || note?.motifMemoryRole
    || note?.preserveSubdivision
    || note?.preserveTiming
    || note?.sectionCompletionRole
    || /(?:triplet|roll|ratchet|stutter|burst)/i.test(rhythmicFeature)
  );
}

function noteEnd(note) {
  return finite(note?.start) + Math.max(0.05, finite(note?.duration, 0.25));
}

function phraseGroups(entries, beatsPerBar = 4) {
  if (!entries.length) return [];
  const breakGap = Math.max(0.5, Math.min(1, beatsPerBar * 0.25));
  const groups = [[entries[0]]];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1].note;
    const gap = finite(entries[index].note?.start) - noteEnd(previous);
    if (gap >= breakGap - 1e-9) groups.push([]);
    groups.at(-1).push(entries[index]);
  }
  return groups;
}

function nearestDistance(value, candidates = []) {
  if (!candidates.length) return Infinity;
  return Math.min(...candidates.map((candidate) => Math.abs(value - candidate)));
}

function phrasePlacementCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  const range = sectionBounds(song, sectionId);
  if (!range || entries.length < 2) return null;
  const groups = phraseGroups(entries, range.beatsPerBar)
    .filter((group) => (
      group.length >= 2
      && group.length <= MAX_PHRASE_PLACEMENT_MOVED_NOTES
      && group.every(({ note }) => !phrasePlacementProtected(note))
    ));
  if (!groups.length) return null;

  const leadPulses = trackGroovePulses(
    song?.grooveConductor,
    "melody",
    range.start,
    range.end,
    range.beatsPerBar,
  );
  if (!leadPulses.length) return null;

  const candidates = [];
  for (const group of groups) {
    const phraseStart = finite(group[0].note?.start);
    const currentDistance = nearestDistance(phraseStart, leadPulses);
    if (currentDistance <= 0.08 + 1e-9) continue;

    for (const pulse of leadPulses) {
      const shift = round(pulse - phraseStart);
      if (
        Math.abs(shift) < 0.04 - 1e-9
        || Math.abs(shift) > MAX_PHRASE_PLACEMENT_SHIFT_BEATS + 1e-9
      ) continue;

      const shiftedStarts = group.map(({ note }) => finite(note?.start) + shift);
      const originalEnds = group.map(({ note }) => noteEnd(note));
      const shiftedEnds = group.map(({ note }, index) => shiftedStarts[index] + Math.max(0.05, finite(note?.duration, 0.25)));
      if (
        shiftedStarts.some((beat) => beat < range.start - 1e-6 || beat >= range.end - 0.02)
        || shiftedEnds.some((beat, index) => beat > Math.max(range.end, originalEnds[index]) + 1e-6)
      ) continue;

      const groupIndices = new Set(group.map(({ index }) => index));
      const collision = entries.some(({ note, index }) => {
        if (groupIndices.has(index)) return false;
        const otherStart = finite(note?.start);
        return shiftedStarts.some((beat) => Math.abs(beat - otherStart) < 0.045);
      });
      if (collision) continue;

      const entryDelay = phraseStart - range.start;
      const shiftedEntryDelay = pulse - range.start;
      const entryImprovement = group === groups[0]
        ? Math.max(0, Math.min(1, entryDelay / Math.max(0.5, range.beatsPerBar))
          - Math.min(1, shiftedEntryDelay / Math.max(0.5, range.beatsPerBar)))
        : 0;
      candidates.push({
        group,
        pulse,
        shift,
        currentDistance,
        score: currentDistance * 2 + entryImprovement * 0.35 - Math.abs(shift) * 0.05,
      });
    }
  }

  candidates.sort((left, right) => (
    right.score - left.score
    || Math.abs(left.shift) - Math.abs(right.shift)
    || left.pulse - right.pulse
  ));
  const selected = candidates[0];
  if (!selected) return null;

  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  if (!track) return null;
  for (const { index } of selected.group) {
    const note = track.notes?.[index];
    if (!note) return null;
    note.start = round(finite(note.start) + selected.shift);
    note.phraseIntentRole = note.phraseIntentRole ?? "phrase-placement-lock";
    note.phrasePlacementRole = "groove-dna-entry-lock";
    note.phrasePlacementShiftBeats = round(selected.shift);
  }
  track.notes.sort((left, right) => finite(left?.start) - finite(right?.start) || finite(left?.pitch) - finite(right?.pitch));
  return {
    id: "phrase-placement-lock",
    song: candidate,
    changedNotes: selected.group.length,
    placementShiftBeats: round(selected.shift),
    placementTargetBeat: round(selected.pulse),
  };
}
function conversationProtected(note) {
  return Boolean(
    protectedPhraseAnchor(note)
    || note?.sectionCompletionRole
    || note?.preservePitch
    || note?.preserveHarmony
    || note?.transitionHandoffRole
    || note?.finalAssemblyRole
  );
}

function directionPattern(group) {
  return group.slice(1).map((entry, index) => Math.sign(
    finite(entry?.note?.pitch) - finite(group[index]?.note?.pitch),
  ));
}

function relativePitchPattern(group) {
  if (group.length < 2) return [];
  const base = finite(group[0]?.note?.pitch);
  return group.slice(1).map((entry) => {
    const interval = finite(entry?.note?.pitch) - base;
    return Math.sign(interval) * Math.min(7, Math.abs(Math.round(interval)));
  });
}

function answerRelationshipNeed(statement, answer) {
  const statementDirections = directionPattern(statement);
  const answerDirections = directionPattern(answer);
  const statementIntervals = relativePitchPattern(statement);
  const answerIntervals = relativePitchPattern(answer);
  const length = Math.min(
    statementDirections.length,
    answerDirections.length,
    statementIntervals.length,
    answerIntervals.length,
  );
  if (!length) return 0;
  let directionMatches = 0;
  let intervalFit = 0;
  for (let index = 0; index < length; index += 1) {
    if (statementDirections[index] === answerDirections[index]) directionMatches += 1;
    intervalFit += clamp(1 - Math.abs(statementIntervals[index] - answerIntervals[index]) / 7, 0, 1);
  }
  const similarity = clamp(
    (directionMatches / length) * 0.58
    + (intervalFit / length) * 0.42,
    0,
    1,
  );
  if (similarity >= 0.46 && similarity <= 0.86) return 0;
  return similarity < 0.46 ? 0.46 - similarity : similarity - 0.86;
}

function allowedPitchClassesForConversation(song, note) {
  const scale = scalePitchClasses(song);
  const chord = chordPitchClasses(harmonyAt(song, finite(note?.start)));
  const strongBeat = Math.abs(finite(note?.start) - Math.round(finite(note?.start))) <= 0.08
    || finite(note?.duration, 0.25) >= 0.7;
  if (strongBeat && chord.length) {
    const chordInScale = scale?.size ? chord.filter((pitchClass) => scale.has(pitchClass)) : chord;
    if (chordInScale.length) return chordInScale;
  }
  if (scale?.size) return [...scale];
  return chord.length ? chord : Array.from({ length: 12 }, (_, index) => index);
}

function bestConversationPitch(song, note, desiredPitch, previousNote = null, nextNote = null) {
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const allowed = allowedPitchClassesForConversation(song, note);
  const source = Math.round(finite(note?.pitch, 60));
  const previousPitch = previousNote ? Math.round(finite(previousNote?.pitch, source)) : source;
  const nextPitch = nextNote ? Math.round(finite(nextNote?.pitch, source)) : source;
  const candidates = [];
  for (let pitch = window.min; pitch <= window.max; pitch += 1) {
    if (!allowed.includes(mod12(pitch))) continue;
    const sourceMove = Math.abs(pitch - source);
    if (sourceMove > 7) continue;
    const leftLeap = Math.abs(pitch - previousPitch);
    const rightLeap = Math.abs(nextPitch - pitch);
    const maxLeap = Math.max(leftLeap, rightLeap);
    if (maxLeap > 10) continue;
    const excessLeap = Math.max(0, maxLeap - 7);
    candidates.push({
      pitch,
      score: Math.abs(pitch - desiredPitch) * 1.8
        + sourceMove * 0.22
        + maxLeap * 0.18
        + excessLeap * 1.7,
    });
  }
  candidates.sort((left, right) => left.score - right.score || left.pitch - right.pitch);
  return candidates[0]?.pitch ?? source;
}

function phraseConversationCandidate(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const entries = notesInSection(song, sectionId);
  if (!range || entries.length < 5) return null;
  const groups = phraseGroups(entries, range.beatsPerBar).filter((group) => group.length >= 2);
  if (groups.length < 2) return null;

  const statement = groups[0];
  const answer = groups[1];
  if (statement.length < 3 || answer.length < 3) return null;
  const need = answerRelationshipNeed(statement, answer);
  if (need <= 1e-6) return null;

  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  if (!track) return null;

  const statementBase = Math.round(finite(statement[0]?.note?.pitch, 60));
  const answerBase = Math.round(finite(answer[0]?.note?.pitch, statementBase));
  const statementPattern = relativePitchPattern(statement);
  let changed = 0;

  const editable = answer
    .map((entry, answerOrdinal) => ({ ...entry, answerOrdinal }))
    .slice(1, -1)
    .filter(({ note }) => !conversationProtected(note))
    .slice(0, MAX_PHRASE_CONVERSATION_PITCH_EDITS);

  for (let ordinal = 0; ordinal < editable.length; ordinal += 1) {
    const { index, answerOrdinal } = editable[ordinal];
    const note = track.notes?.[index];
    if (!note) continue;
    const sourcePatternIndex = Math.min(ordinal, Math.max(0, statementPattern.length - 1));
    let relative = finite(statementPattern[sourcePatternIndex], 0);
    if (ordinal === editable.length - 1 && Math.abs(relative) >= 2) {
      relative -= Math.sign(relative);
    }
    const desired = answerBase + relative;
    const previousNote = track.notes?.[answer[Math.max(0, answerOrdinal - 1)]?.index] ?? null;
    const nextNote = track.notes?.[answer[Math.min(answer.length - 1, answerOrdinal + 1)]?.index] ?? null;
    const nextPitch = bestConversationPitch(candidate, note, desired, previousNote, nextNote);
    if (nextPitch === Math.round(finite(note.pitch, 60))) continue;
    note.pitch = nextPitch;
    note.phraseIntentRole = note.phraseIntentRole ?? "phrase-answer-development";
    note.phraseConversationRole = "answer-variation";
    note.phraseConversationSourceBeat = round(finite(statement[Math.min(ordinal + 1, statement.length - 1)]?.note?.start));
    changed += 1;
  }

  if (!changed) return null;
  return {
    id: "phrase-conversation-development",
    song: candidate,
    changedNotes: changed,
    conversationPitchEdits: changed,
    conversationNeed: round(need),
  };
}

function melodicArcPayoffCandidate(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const entries = notesInSection(song, sectionId);
  if (!range || entries.length < 5) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  if (!track) return null;

  const sectionLength = Math.max(0.25, range.end - range.start);
  const payoffEntries = entries.filter(({ note }) => {
    const phase = (finite(note?.start) - range.start) / sectionLength;
    return phase >= 0.56 && phase <= 0.84 && !conversationProtected(note);
  });
  if (!payoffEntries.length) return null;

  const currentPeak = Math.max(...entries.map(({ note }) => finite(note?.pitch, 60)));
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  let changed = 0;
  const ranked = payoffEntries
    .map((entry) => {
      const phase = (finite(entry.note?.start) - range.start) / sectionLength;
      return { ...entry, phase, distance: Math.abs(phase - 0.7) };
    })
    .sort((a, b) => a.distance - b.distance || finite(a.note?.start) - finite(b.note?.start))
    .slice(0, MAX_MELODIC_ARC_PITCH_EDITS);

  for (const { index } of ranked) {
    const note = track.notes?.[index];
    if (!note) continue;
    const source = Math.round(finite(note.pitch, 60));
    const chord = chordPitchClasses(harmonyAt(candidate, finite(note.start)));
    const scale = scalePitchClasses(candidate);
    let allowed = chord.length ? chord : (scale?.size ? [...scale] : []);
    if (scale?.size && allowed.length) allowed = allowed.filter((pc) => scale.has(pc));
    if (!allowed.length && scale?.size) allowed = [...scale];
    if (!allowed.length) continue;

    const options = [];
    for (let pitch = Math.max(window.min, source); pitch <= window.max; pitch += 1) {
      if (!allowed.includes(mod12(pitch))) continue;
      const lift = pitch - source;
      if (lift < 2 || lift > 7) continue;
      const previous = track.notes?.[Math.max(0, index - 1)];
      const next = track.notes?.[Math.min(track.notes.length - 1, index + 1)];
      const maxLeap = Math.max(
        previous ? Math.abs(pitch - finite(previous.pitch, pitch)) : 0,
        next ? Math.abs(finite(next.pitch, pitch) - pitch) : 0,
      );
      if (maxLeap > 10) continue;
      options.push({
        pitch,
        score: Math.abs(Math.max(currentPeak, source + 3) - pitch) + maxLeap * 0.25 + lift * 0.08,
      });
    }
    options.sort((a, b) => a.score - b.score || a.pitch - b.pitch);
    const selected = options[0];
    if (!selected || selected.pitch === source) continue;
    note.pitch = selected.pitch;
    note.phraseIntentRole = note.phraseIntentRole ?? "melodic-arc-payoff";
    note.melodicArcRole = "section-payoff-lift";
    changed += 1;
  }

  if (!changed) return null;
  return {
    id: "melodic-arc-payoff",
    song: candidate,
    changedNotes: changed,
    melodicArcPitchEdits: changed,
  };
}

function contourOutlierCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (entries.length < 3) return null;

  let target = null;
  for (let ordinal = 1; ordinal < entries.length - 1; ordinal += 1) {
    const entry = entries[ordinal];
    if (protectedPhraseAnchor(entry.note)) continue;

    const previous = Math.round(finite(entries[ordinal - 1].note.pitch));
    const current = Math.round(finite(entry.note.pitch));
    const next = Math.round(finite(entries[ordinal + 1].note.pitch));
    const left = Math.abs(current - previous);
    const right = Math.abs(next - current);
    const direct = Math.abs(next - previous);
    const isolatedSpike = left >= 7 && right >= 7 && direct <= 5;
    const extremeTurn = Math.max(left, right) > 10 && direct <= 7;
    if (!isolatedSpike && !extremeTurn) continue;

    const severity = left + right - direct * 0.5;
    if (!target || severity > target.severity) target = { entry, ordinal, severity };
  }

  if (!target) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const note = track?.notes?.[target.entry.index];
  const previous = track?.notes?.[entries[target.ordinal - 1].index];
  const next = track?.notes?.[entries[target.ordinal + 1].index];
  if (!note || !previous || !next) return null;

  const sourcePitch = Math.round(finite(note.pitch, 60));
  const previousPitch = Math.round(finite(previous.pitch, sourcePitch));
  const nextPitch = Math.round(finite(next.pitch, sourcePitch));
  const midpoint = (previousPitch + nextPitch) / 2;
  const scale = scalePitchClasses(candidate);
  const chord = harmonyAt(candidate, finite(note.start));
  const chordClasses = chordPitchClasses(chord);
  const strongLanding = finite(note.duration, 0.25) >= 0.65
    || Math.abs(finite(note.start) - Math.round(finite(note.start))) <= 0.08;

  let allowed = strongLanding && chordClasses.length ? chordClasses : (scale?.size ? [...scale] : chordClasses);
  if (scale?.size && allowed.length) allowed = allowed.filter((pitchClass) => scale.has(pitchClass));
  if (!allowed.length && scale?.size) allowed = [...scale];
  if (!allowed.length) allowed = Array.from({ length: 12 }, (_, index) => index);

  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const originalSpan = Math.max(
    Math.abs(sourcePitch - previousPitch),
    Math.abs(nextPitch - sourcePitch),
  );
  const options = [];
  for (let pitch = window.min; pitch <= window.max; pitch += 1) {
    if (pitch === sourcePitch || !allowed.includes(mod12(pitch))) continue;
    const span = Math.max(Math.abs(pitch - previousPitch), Math.abs(nextPitch - pitch));
    if (span >= originalSpan) continue;
    const score = Math.abs(pitch - midpoint) * 2
      + Math.abs(pitch - previousPitch) * 0.35
      + Math.abs(nextPitch - pitch) * 0.35
      + Math.abs(pitch - sourcePitch) * 0.08;
    options.push({ pitch, span, score });
  }
  options.sort((left, right) => left.score - right.score || left.span - right.span || left.pitch - right.pitch);
  const selected = options[0];
  if (!selected) return null;

  note.pitch = selected.pitch;
  const neighborVelocity = Math.round((finite(previous.velocity, 84) + finite(next.velocity, 84)) / 2);
  note.velocity = Math.round(clamp(
    finite(note.velocity, 84) * 0.45 + neighborVelocity * 0.55,
    1,
    120,
  ));
  note.phraseIntentRole = "contour-outlier-repair";
  return { id: "contour-outlier-repair", song: candidate, changedNotes: 1 };
}
function expressiveArcCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (entries.length < 4) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  let changed = 0;
  entries.forEach(({ index }, ordinal) => {
    const note = track?.notes?.[index];
    if (!note) return;
    const phase = ordinal / Math.max(1, entries.length - 1);
    const arc = Math.sin(Math.PI * phase);
    const velocityDelta = Math.round(arc * 8 - (phase > 0.82 ? 2 : 0));
    const durationScale = phase > 0.8 ? 1.12 : (ordinal % 2 === 0 ? 0.92 : 1.04);
    const nextVelocity = Math.round(clamp(finite(note.velocity, 84) + velocityDelta, 1, 120));
    const nextDuration = round(clamp(finite(note.duration, 0.25) * durationScale, 0.12, 1.5));
    if (nextVelocity !== note.velocity || Math.abs(nextDuration - finite(note.duration, 0.25)) > 1e-6) changed += 1;
    note.velocity = nextVelocity;
    note.duration = nextDuration;
    note.phraseIntentRole = note.phraseIntentRole ?? "expressive-arc";
  });
  return changed ? { id: "expressive-arc", song: candidate, changedNotes: changed } : null;
}

/**
 * Builds a tiny deterministic candidate set for the weakest melody section.
 * It never changes rhythm-section tracks or note topology. Phrase placement may
 * move one intact phrase as a unit; phrase conversation may repitch only a few
 * unprotected notes inside an existing answer phrase.
 */
export function createMelodyPhraseCandidates(song, {
  maxCandidates = MAX_MELODY_PHRASE_CANDIDATES,
} = {}) {
  const before = evaluateMelodyPhraseIntelligence(song);
  const conversationSection = before?.weakestConversationSection;
  const arcSection = before?.weakestArcSection;
  const placementSection = before?.weakestPlacementSection;
  const conversationWeak = finite(
    conversationSection?.metrics?.phraseConversation,
    1,
  ) < MIN_PHRASE_CONVERSATION_SCORE;
  const arcWeak = finite(arcSection?.metrics?.melodicArcPayoff, 1) < MIN_MELODIC_ARC_PAYOFF_SCORE;
  const placementWeak = finite(placementSection?.metrics?.phrasePlacement, 1) < 0.76;
  const sectionId = conversationWeak
    ? conversationSection?.sectionId
    : arcWeak
      ? arcSection?.sectionId
      : placementWeak
        ? placementSection?.sectionId
        : before?.weakestSection?.sectionId;
  if (!sectionId) return [];

  const conversation = conversationWeak
    ? phraseConversationCandidate(song, sectionId)
    : null;
  const arc = arcWeak && String(arcSection?.sectionId) === String(sectionId)
    ? melodicArcPayoffCandidate(song, sectionId)
    : null;
  const placement = placementWeak && String(placementSection?.sectionId) === String(sectionId)
    ? phrasePlacementCandidate(song, sectionId)
    : null;
  const raw = conversation
    ? [
      conversation,
      placement ?? sectionLandingCandidate(song, sectionId),
      contourOutlierCandidate(song, sectionId) ?? arc ?? expressiveArcCandidate(song, sectionId),
    ].filter(Boolean)
    : arc
      ? [
        arc,
        placement ?? sectionLandingCandidate(song, sectionId),
        contourOutlierCandidate(song, sectionId) ?? expressiveArcCandidate(song, sectionId),
      ].filter(Boolean)
    : placement
      ? [
        placement,
        sectionLandingCandidate(song, sectionId),
        contourOutlierCandidate(song, sectionId),
      ].filter(Boolean)
      : [
        sectionLandingCandidate(song, sectionId),
        contourOutlierCandidate(song, sectionId),
        expressiveArcCandidate(song, sectionId),
      ].filter(Boolean);
  const seen = new Set();
  return raw.slice(0, Math.max(0, Math.min(MAX_MELODY_PHRASE_CANDIDATES, Math.floor(finite(maxCandidates, MAX_MELODY_PHRASE_CANDIDATES)))))
    .map((candidate, candidateIndex) => {
      const after = evaluateMelodyPhraseIntelligence(candidate.song);
      const signature = JSON.stringify(melodyTrack(candidate.song)?.notes?.map((note) => [
        round(note.start), Math.round(finite(note.pitch)), round(note.duration), Math.round(finite(note.velocity, 84)),
      ]) ?? []);
      if (seen.has(signature)) return null;
      seen.add(signature);
      const beforeSection = (before.sections ?? []).find(
        (entry) => String(entry.sectionId) === String(sectionId),
      ) ?? null;
      const afterSection = (after.sections ?? []).find(
        (entry) => String(entry.sectionId) === String(sectionId),
      ) ?? null;
      const beforeConversationScore = finite(beforeSection?.metrics?.phraseConversation, 1);
      const afterConversationScore = finite(afterSection?.metrics?.phraseConversation, 1);
      const beforeArcScore = finite(beforeSection?.metrics?.melodicArcPayoff, 1);
      const afterArcScore = finite(afterSection?.metrics?.melodicArcPayoff, 1);
      return {
        ...candidate,
        candidateIndex,
        weakestSectionId: sectionId,
        beforePhraseScore: before.score,
        afterPhraseScore: after.score,
        phraseScoreDelta: after.score - before.score,
        beforeConversationScore,
        afterConversationScore,
        conversationDelta: afterConversationScore - beforeConversationScore,
        beforeArcScore,
        afterArcScore,
        arcDelta: afterArcScore - beforeArcScore,
        beforeReport: before,
        afterReport: after,
      };
    })
    .filter(Boolean)
    .filter((candidate) => (
      candidate.phraseScoreDelta > 0
      || candidate.conversationDelta > 0.02
      || candidate.arcDelta > 0.04
    ));
}
