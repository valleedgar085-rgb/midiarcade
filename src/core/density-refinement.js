const SUPPORT_TRACK_PRIORITY = Object.freeze(["chords", "counterpoint", "pad"]);
const SPLITS_PER_BAR = Object.freeze([0.25, 0.5, 1]);

export const MAX_DENSITY_REFINEMENT_CANDIDATES = SPLITS_PER_BAR.length;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function songBars(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function pitchedNoteCount(song) {
  return (song?.tracks ?? [])
    .filter((track) => track?.id !== "drums")
    .reduce((sum, track) => sum + (track?.notes?.length ?? 0), 0);
}

function notesPerBar(song) {
  return pitchedNoteCount(song) / songBars(song);
}

function protectedSupportNote(note) {
  return Boolean(
    note?.resolutionRole
    || note?.memoryRole
    || note?.transitionRole
    || note?.cadenceRole
    || note?.hookRole
    || note?.phraseRole === "landing"
  );
}

function eligibleSplitNotes(song) {
  const trackRank = new Map(SUPPORT_TRACK_PRIORITY.map((id, index) => [id, index]));
  return (song?.tracks ?? [])
    .filter((track) => trackRank.has(track?.id))
    .flatMap((track) => (track.notes ?? []).map((note, noteIndex) => ({
      trackId: track.id,
      noteIndex,
      note,
    })))
    .filter(({ note }) => finite(note?.duration) >= 0.5 && !protectedSupportNote(note))
    .sort((left, right) => {
      const durationDelta = finite(right.note.duration) - finite(left.note.duration);
      if (Math.abs(durationDelta) > 1e-9) return durationDelta;
      const trackDelta = trackRank.get(left.trackId) - trackRank.get(right.trackId);
      if (trackDelta) return trackDelta;
      const startDelta = finite(left.note.start) - finite(right.note.start);
      if (Math.abs(startDelta) > 1e-9) return startDelta;
      const pitchDelta = finite(left.note.pitch) - finite(right.note.pitch);
      if (pitchDelta) return pitchDelta;
      return left.noteIndex - right.noteIndex;
    });
}

function splitSupportNote(note, splitIndex) {
  const sourceDuration = finite(note.duration);
  const firstDuration = round(sourceDuration * 0.5);
  const secondDuration = round(sourceDuration - firstDuration);
  const sourceId = String(note.id ?? `support-${finite(note.start)}-${finite(note.pitch)}`);
  return [
    {
      ...note,
      id: `${sourceId}:density-a-${splitIndex}`,
      duration: firstDuration,
      densityRefinementRole: "support-articulation",
    },
    {
      ...note,
      id: `${sourceId}:density-b-${splitIndex}`,
      start: round(finite(note.start) + firstDuration),
      duration: secondDuration,
      densityRefinementRole: "support-articulation",
    },
  ];
}

function articulateSupport(song, splitCount) {
  const candidate = clone(song);
  const eligible = eligibleSplitNotes(candidate).slice(0, splitCount);
  const selected = new Map();
  eligible.forEach((entry, index) => {
    const key = `${entry.trackId}:${entry.noteIndex}`;
    selected.set(key, splitSupportNote(entry.note, index));
  });

  for (const track of candidate.tracks ?? []) {
    if (!SUPPORT_TRACK_PRIORITY.includes(track.id)) continue;
    track.notes = (track.notes ?? []).flatMap((note, noteIndex) => (
      selected.get(`${track.id}:${noteIndex}`) ?? [note]
    ));
    track.notes.sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
  }

  return {
    song: candidate,
    changedNotes: eligible.length,
  };
}

/**
 * Phase 6D density refinement is intentionally build-only. Calibration shows
 * every benchmark genre is currently below its critic density target, so this
 * candidate boundary only adds articulation to existing support tones. It does
 * not invent pitches, change harmony, touch melody/drums, or lengthen material.
 */
export function createDensityRefinementCandidates(song, {
  densityTarget = 0,
  maxCandidates = MAX_DENSITY_REFINEMENT_CANDIDATES,
} = {}) {
  const bars = songBars(song);
  const beforeNotesPerBar = notesPerBar(song);
  const target = Math.max(0, finite(densityTarget));
  const deficitNotes = Math.max(0, Math.ceil((target - beforeNotesPerBar) * bars));
  const eligibleCount = eligibleSplitNotes(song).length;
  if (deficitNotes <= 0 || eligibleCount <= 0) return [];

  const seenBudgets = new Set();
  return SPLITS_PER_BAR
    .slice(0, Math.max(0, Math.min(MAX_DENSITY_REFINEMENT_CANDIDATES, Math.floor(maxCandidates))))
    .map((splitsPerBar, candidateIndex) => {
      const splitCount = Math.min(
        deficitNotes,
        eligibleCount,
        Math.max(1, Math.ceil(bars * splitsPerBar)),
      );
      if (seenBudgets.has(splitCount)) return null;
      seenBudgets.add(splitCount);
      const articulated = articulateSupport(song, splitCount);
      const afterNotesPerBar = notesPerBar(articulated.song);
      return {
        id: ["light-support", "balanced-support", "full-support"][candidateIndex],
        candidateIndex,
        song: articulated.song,
        changedNotes: articulated.changedNotes,
        beforeNotesPerBar: round(beforeNotesPerBar, 3),
        afterNotesPerBar: round(afterNotesPerBar, 3),
        densityTarget: round(target, 3),
        densityErrorDelta: round(
          Math.abs(afterNotesPerBar - target) - Math.abs(beforeNotesPerBar - target),
          3,
        ),
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.changedNotes > 0 && candidate.densityErrorDelta < -1e-6);
}
