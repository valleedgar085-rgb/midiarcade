import {
  phraseResolutionArticulationSatisfied,
  phraseResolutionDesiredDuration,
} from "./phrase-resolution-style.js";
import { cloneValue } from "./clone-value.js";
export const MAX_PHRASE_RESOLUTION_CANDIDATES = 3;
export const MAX_PHRASE_RESOLUTION_EDITS = 3;

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

function mod(value, modulus) {
  return ((finite(value) % modulus) + modulus) % modulus;
}

function harmonyAt(harmony, beat) {
  let result = harmony?.[0] ?? null;
  for (const event of harmony ?? []) {
    if (finite(event?.start) <= beat + 1e-6) result = event;
    if (
      beat < finite(event?.start) + finite(event?.duration) - 1e-6
      && beat >= finite(event?.start) - 1e-6
    ) return event;
  }
  return result;
}

function chordToneSet(chord) {
  return new Set((chord?.tones ?? [])
    .map((tone) => mod(tone, 12))
    .filter((tone) => Number.isFinite(tone)));
}

function landingScore(note, chord, tonic, beatsPerBar, genre, sectionEnd) {
  if (!note) return 0.55;
  const tones = chordToneSet(chord);
  const pitchClass = mod(note.pitch, 12);
  const chordTone = tones.has(pitchClass);
  const tonicLanding = pitchClass === tonic;
  const articulated = phraseResolutionArticulationSatisfied({
    genre,
    note,
    sectionEnd,
    beatsPerBar,
  });
  return clamp(
    0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(articulated) * 0.12,
    0,
    1,
  );
}

// Cadence candidates may be accepted by the production quality pipeline, so
// prefer a diatonic, contour-safe landing over a closer but awkward jump.
function scaleClasses(song) {
  const key = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(key) || !Array.isArray(intervals) || !intervals.length
    || intervals.some((step) => !Number.isFinite(Number(step)))) return null;
  return new Set(intervals.map((step) => mod(key + Number(step), 12)));
}

function protectedLanding(note) {
  return Boolean(note?.motifMemoryCore || note?.ensembleCadenceRole
    || note?.transitionHandoffRole || note?.motifHandoffRole
    || note?.finalAssemblyRole || note?.phraseRole === "turnaround"
    || ["motif-core", "memory-landing", "cadential-landing", "motif-recall-anchor"]
      .includes(String(note?.phraseIntentRole))
    || ["motif-core", "memory-landing", "cadential-landing", "motif-recall-anchor"]
      .includes(String(note?.sectionDevelopmentRole)));
}

function precedingSectionPitch(song, section, currentNote) {
  const melody = (song?.tracks ?? []).find((track) => track?.id === "melody");
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat) : finite(section?.startBar, 0) * beatsPerBar;
  const currentStart = Number(currentNote?.start);
  if (!Number.isFinite(currentStart)) return null;
  const preceding = (melody?.notes ?? [])
    .filter((note) => Number.isFinite(Number(note?.start))
      && Number.isFinite(Number(note?.pitch))
      && Number(note.start) >= start - 1e-6
      && Number(note.start) < currentStart - 1e-6)
    .sort((left, right) => Number(left.start) - Number(right.start)
      || Number(left.pitch) - Number(right.pitch)).at(-1);
  return preceding ? Number(preceding.pitch) : null;
}

function nearestChordPitch(sourcePitch, chord, tonic, preferTonic = false, {
  scale = null, previousPitch = null,
} = {}) {
  const original = Math.round(finite(sourcePitch, 60));
  const tones = [...chordToneSet(chord)]
    .filter((pitchClass) => !scale || scale.has(pitchClass));
  if (!tones.length) return original;
  const classes = preferTonic && tones.includes(tonic) ? [tonic] : tones;
  const previous = Number.isFinite(previousPitch) ? previousPitch : null;
  const leapBudget = previous === null ? Infinity : Math.max(7, Math.abs(original - previous));
  const choices = [];
  for (let candidate = Math.max(0, original - 12);
    candidate <= Math.min(127, original + 12); candidate += 1) {
    if (!classes.includes(mod(candidate, 12))) continue;
    // A resolution should not rewrite the recognizability of the phrase.
    // Keep local pitch edits within a perfect fourth in either direction.
    if (Math.abs(candidate - original) > 5) continue;
    // Never create a bigger melodic leap than the existing phrase, with a
    // seven-semitone allowance for an ordinary expressive phrase.
    if (previous !== null && Math.abs(candidate - previous) > leapBudget + 1e-6) continue;
    choices.push(candidate);
  }
  return choices.sort((left, right) =>
    Math.abs(left - original) - Math.abs(right - original)
    || (previous === null ? 0 : Math.abs(left - previous) - Math.abs(right - previous))
    || left - right)[0] ?? original;
}

function sectionLandingEntries(song) {
  const melodyTrack = (song?.tracks ?? []).find((track) => track?.id === "melody");
  const melody = (melodyTrack?.notes ?? []).map((note, noteIndex) => ({ note, noteIndex }))
    .sort((left, right) => finite(left.note.start) - finite(right.note.start) || left.noteIndex - right.noteIndex);
  const sections = song?.structure ?? song?.sections ?? [];
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const tonic = mod(song?.meta?.keyPc, 12);

  return sections.map((section, sectionIndex) => {
    const endBeat = finite(section?.endBeat);
    const windowStart = endBeat - beatsPerBar * 1.25;
    const phraseNotes = melody.filter(({ note }) => (
      finite(note.start) < endBeat - 0.01
      && finite(note.start) >= windowStart
    ));
    const landing = phraseNotes.at(-1) ?? null;
    const chord = landing ? harmonyAt(song?.harmony ?? [], finite(landing.note.start)) : null;
    const score = landing ? landingScore(
      landing.note,
      chord,
      tonic,
      beatsPerBar,
      song?.genre ?? song?.meta?.genre,
      endBeat,
    ) : 0.55;
    return {
      section,
      sectionIndex,
      landing,
      chord,
      score,
      beatsPerBar,
      tonic,
      isFinal: sectionIndex === sections.length - 1,
    };
  });
}

function selectedEntries(song, limit, hold, payoff) {
  return sectionLandingEntries(song)
    .filter((entry) => {
      if (!entry.landing) return false;
      const tones = chordToneSet(entry.chord);
      if (!tones.size) return false;
      const note = entry.landing.note;
      if (protectedLanding(note)) return false;
      const pitchClass = mod(note.pitch, 12);
      const genre = song?.genre ?? song?.meta?.genre;
      const desiredDuration = phraseResolutionDesiredDuration(genre, entry.beatsPerBar);
      const articulated = phraseResolutionArticulationSatisfied({
        genre,
        note,
        sectionEnd: entry.section?.endBeat,
        beatsPerBar: entry.beatsPerBar,
      });
      return !tones.has(pitchClass)
        || (payoff && entry.isFinal && tones.has(entry.tonic) && pitchClass !== entry.tonic)
        || (hold
          && !articulated
          && finite(note.duration) < desiredDuration
          && finite(entry.section?.endBeat) - finite(note.start) - 0.02 >= desiredDuration);
    })
    .sort((left, right) => (
      Number(payoff && right.isFinal) - Number(payoff && left.isFinal)
      || left.score - right.score
      || left.sectionIndex - right.sectionIndex
    ))
    .slice(0, limit);
}

function refineLandingCandidate(song, limit, { hold = false, payoff = false } = {}) {
  const candidate = cloneValue(song);
  const melody = (candidate.tracks ?? []).find((track) => track?.id === "melody");
  if (!melody) return { song: candidate, edits: 0, pitchEdits: 0, durationEdits: 0 };

  const selected = selectedEntries(candidate, limit, hold, payoff);
  let edits = 0;
  let pitchEdits = 0;
  let durationEdits = 0;

  for (const entry of selected) {
    const note = melody.notes?.[entry.landing.noteIndex];
    if (!note) continue;
    const preferTonic = Boolean(
      payoff
      && entry.isFinal
      && chordToneSet(entry.chord).has(entry.tonic)
    );
    const desiredPitch = nearestChordPitch(finite(note.pitch), entry.chord, entry.tonic, preferTonic, {
      scale: scaleClasses(candidate),
      previousPitch: precedingSectionPitch(candidate, entry.section, note),
    });
    let changed = false;
    if (desiredPitch !== note.pitch) {
      note.pitch = desiredPitch;
      pitchEdits += 1;
      changed = true;
    }

    if (hold) {
      const desiredDuration = entry.beatsPerBar * 0.35;
      const availableDuration = Math.max(0.08, finite(entry.section?.endBeat) - finite(note.start) - 0.02);
      const nextDuration = round(Math.min(Math.max(finite(note.duration), desiredDuration), availableDuration));
      if (nextDuration > finite(note.duration) + 1e-6) {
        note.duration = nextDuration;
        durationEdits += 1;
        changed = true;
      }
    }

    if (changed) {
      note.resolutionRole = preferTonic ? "tonic-landing" : "chord-landing";
      note.phraseBoundary = round(entry.section?.endBeat);
      note.preserveTiming = true;
      note.phraseResolutionRefinementRole = payoff ? "payoff" : hold ? "held-cadence" : "chord-cadence";
      edits += 1;
    }
  }

  melody.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  return { song: candidate, edits, pitchEdits, durationEdits };
}

function meanLandingScore(song) {
  const values = sectionLandingEntries(song).map((entry) => entry.score);
  if (!values.length) return 0.68;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Phase 6D phrase-resolution candidates only touch the final existing melody
 * note of up to three section-ending windows. They do not add/delete notes,
 * alter onset timing, rewrite harmony, or touch any non-melody track.
 */
export function createPhraseResolutionCandidates(song, {
  maxCandidates = MAX_PHRASE_RESOLUTION_CANDIDATES,
} = {}) {
  const beforeScore = meanLandingScore(song);
  const recipes = [
    { id: "chord-cadence", limit: 1, hold: false, payoff: false },
    { id: "held-cadence", limit: 2, hold: true, payoff: false },
    { id: "payoff-cadence", limit: 3, hold: true, payoff: true },
  ];
  const seen = new Set();

  return recipes
    .slice(0, Math.max(0, Math.min(MAX_PHRASE_RESOLUTION_CANDIDATES, Math.floor(maxCandidates))))
    .map((recipe, candidateIndex) => {
      const refined = refineLandingCandidate(song, recipe.limit, recipe);
      const afterScore = meanLandingScore(refined.song);
      const signature = JSON.stringify((refined.song.tracks ?? []).find((track) => track.id === "melody")?.notes ?? []);
      if (seen.has(signature)) return null;
      seen.add(signature);
      return {
        id: recipe.id,
        candidateIndex,
        song: refined.song,
        changedNotes: refined.edits,
        pitchEdits: refined.pitchEdits,
        durationEdits: refined.durationEdits,
        beforeLocalScore: round(beforeScore * 100, 2),
        afterLocalScore: round(afterScore * 100, 2),
        localScoreDelta: round((afterScore - beforeScore) * 100, 2),
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.changedNotes > 0 && candidate.localScoreDelta > 0);
}
