import { clamp, finite } from "../utils.js";

const TRACK_GROUPS = Object.freeze({
  full: null,
  rhythm: Object.freeze(["drums", "bass"]),
  harmony: Object.freeze(["chords", "pad"]),
  leads: Object.freeze(["melody", "counterpoint"]),
});

const PROFILE_LABELS = Object.freeze({
  full: "Full song",
  rhythm: "Rhythm section",
  harmony: "Harmony bed",
  leads: "Lead voices",
  selected: "Selected instrument",
});

// DAW export deliberately uses a tighter articulation envelope than preview
// playback. Preview is free to use longer release/gate behavior for feel, but a
// .mid file should never create painfully long or overlapping note releases.
const EXPORT_DURATION_LIMITS = Object.freeze({
  drums: 0.45,
  bass: 1.5,
  chords: 2.5,
  melody: 1.5,
  counterpoint: 1.25,
  pad: 3,
});

// Keep these aligned with the canonical TRACK_DEFINITIONS gate defaults used by
// the MIDI writer. Export uses them only to neutralize post-sanitize gate
// expansion; direct engine exports retain their normal performance behavior.
const EXPORT_DEFAULT_GATES = Object.freeze({
  drums: 0.85,
  bass: 0.82,
  chords: 0.9,
  melody: 0.88,
  counterpoint: 0.94,
  pad: 1,
});

const GENERATED_TRACK_IDS = new Set(Object.keys(EXPORT_DURATION_LIMITS));
const EXPORT_RELEASE_GAP = 0.04;
const EXPORT_MIN_DURATION = 0.05;
const EXPORT_ENCODER_MIN_DURATION = 1 / 480;
const EXPORT_NEAR_DUPLICATE_WINDOW = EXPORT_RELEASE_GAP + EXPORT_MIN_DURATION;

function quantizeNotes(notes, totalBeats, step = 0.25) {
  const byOnset = new Map();
  for (const source of notes ?? []) {
    const start = clamp(Math.round(finite(source.start) / step) * step, 0, Math.max(0, totalBeats - step / 2));
    const rawEnd = finite(source.start) + Math.max(step / 2, finite(source.duration, step));
    const end = clamp(Math.round(rawEnd / step) * step, start + step / 2, totalBeats);
    const note = { ...source, start, duration: Math.max(step / 2, end - start) };
    const identity = `${Math.round(finite(note.pitch, 60))}:${start.toFixed(6)}`;
    const existing = byOnset.get(identity);
    if (!existing || finite(note.velocity) > finite(existing.velocity)) byOnset.set(identity, note);
  }
  return [...byOnset.values()].sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

function collapseNearDuplicateOnsets(notes) {
  const kept = [];
  for (const note of notes) {
    const pitch = Math.round(finite(note.pitch, 60));
    const start = finite(note.start, 0);
    let duplicateIndex = -1;
    for (let index = kept.length - 1; index >= 0; index -= 1) {
      const candidate = kept[index];
      const distance = start - finite(candidate.start, 0);
      if (distance > EXPORT_NEAR_DUPLICATE_WINDOW) break;
      if (Math.round(finite(candidate.pitch, 60)) === pitch && Math.abs(distance) <= EXPORT_NEAR_DUPLICATE_WINDOW) {
        duplicateIndex = index;
        break;
      }
    }
    if (duplicateIndex < 0) {
      kept.push(note);
      continue;
    }
    const existing = kept[duplicateIndex];
    if (finite(note.velocity, 0) > finite(existing.velocity, 0)) kept[duplicateIndex] = note;
  }
  return kept.sort((left, right) => finite(left.start, 0) - finite(right.start, 0) || finite(left.pitch, 60) - finite(right.pitch, 60));
}

function sectionEndForBeat(structure, beat, totalBeats) {
  const section = (structure ?? []).find((candidate) => (
    beat >= finite(candidate.startBeat, 0) - 1e-6
    && beat < finite(candidate.endBeat, totalBeats) - 1e-6
  ));
  return clamp(finite(section?.endBeat, totalBeats), beat + EXPORT_MIN_DURATION, totalBeats);
}

function exportGateScale(track) {
  const id = String(track?.id ?? "");
  const defaultGate = finite(EXPORT_DEFAULT_GATES[id], 1);
  const gate = clamp(finite(track?.settings?.gate, defaultGate), 0.08, 1.5);
  return clamp(Math.sqrt(gate / Math.max(0.08, defaultGate)), 0.65, 1.4);
}

function sanitizeExportNotes(track, structure, totalBeats) {
  const id = String(track?.id ?? "");
  const roleLimit = finite(EXPORT_DURATION_LIMITS[id], 2);
  const gateScale = exportGateScale(track);
  const source = collapseNearDuplicateOnsets([...(track?.notes ?? [])]
    .map((note) => ({ ...note }))
    .sort((left, right) => finite(left.start, 0) - finite(right.start, 0) || finite(left.pitch, 60) - finite(right.pitch, 60)));

  return source.map((note, index) => {
    const start = clamp(finite(note.start, 0), 0, Math.max(0, totalBeats - EXPORT_MIN_DURATION));
    const sourceDuration = Math.max(EXPORT_MIN_DURATION, finite(note.duration, 0.25));
    const pitch = Math.round(finite(note.pitch, 60));
    const nextSamePitch = source.slice(index + 1).find((candidate) => (
      Math.round(finite(candidate.pitch, 60)) === pitch
      && finite(candidate.start, totalBeats) > start + 1e-6
    ));
    const retriggerLimit = nextSamePitch
      ? Math.max(EXPORT_MIN_DURATION, finite(nextSamePitch.start, totalBeats) - start - EXPORT_RELEASE_GAP)
      : roleLimit;
    const boundaryLimit = Math.max(
      EXPORT_MIN_DURATION,
      sectionEndForBeat(structure, start, totalBeats) - start - EXPORT_RELEASE_GAP,
    );
    const endOfSongLimit = Math.max(EXPORT_MIN_DURATION, totalBeats - start);
    const safeFinalDuration = Math.max(
      EXPORT_MIN_DURATION,
      Math.min(sourceDuration, roleLimit, retriggerLimit, boundaryLimit, endOfSongLimit),
    );
    // The MIDI writer applies track gate plus phrase-performance scaling after
    // this profile runs. Prevent either stage from lengthening a safe note by
    // pre-compensating gate > 1 and clamping phrase duration expansion to 1.
    const storedDuration = safeFinalDuration / Math.max(1, gateScale);
    const phraseDurationScale = Math.min(1, clamp(finite(note.phrasePerformanceDurationScale, 1), 0.72, 1.28));
    return {
      ...note,
      start,
      duration: Number(Math.max(EXPORT_ENCODER_MIN_DURATION, storedDuration).toFixed(6)),
      phrasePerformanceDurationScale: phraseDurationScale,
    };
  });
}

function sanitizeGeneratedSustain(track, preserveSustain) {
  if (preserveSustain || !GENERATED_TRACK_IDS.has(String(track?.id ?? ""))) return track;
  return {
    ...track,
    automation: (track.automation ?? []).filter((event) => !(
      event?.type === "cc" && Math.round(finite(event.controller, -1)) === 64
    )),
  };
}

function applySafeExportArticulation(song, { preserveSustain = false } = {}) {
  const totalBeats = Math.max(EXPORT_MIN_DURATION, finite(song?.meta?.totalBeats, 0));
  song.tracks = (song.tracks ?? []).map((sourceTrack) => {
    const track = sanitizeGeneratedSustain(sourceTrack, preserveSustain);
    return {
      ...track,
      notes: sanitizeExportNotes(track, song.structure ?? song.sections ?? [], totalBeats),
    };
  });
  song.meta = {
    ...song.meta,
    exportArticulation: {
      version: 2,
      safeNoteLengths: true,
      duplicateRetriggersCollapsed: true,
      postEncoderLengtheningBlocked: true,
      generatedSustainNormalized: !preserveSustain,
    },
  };
  return song;
}

export function resolveMidiExportProfile(profile = "full", selectedTrackId = null) {
  const id = Object.hasOwn(PROFILE_LABELS, profile) ? profile : "full";
  const trackIds = id === "selected"
    ? (selectedTrackId ? [String(selectedTrackId)] : null)
    : TRACK_GROUPS[id];
  return {
    id,
    label: PROFILE_LABELS[id],
    trackIds: trackIds ? [...trackIds] : null,
    filenameSuffix: id === "full" ? "" : `-${id === "selected" ? String(selectedTrackId || "track") : id}`,
  };
}

export function prepareMidiExport(song, {
  profile = "full",
  timing = "performance",
  selectedTrackId = null,
  preserveSustain = false,
} = {}) {
  if (!song?.meta || !Array.isArray(song.tracks)) throw new TypeError("prepareMidiExport requires a song JSON object");
  const resolved = resolveMidiExportProfile(profile, selectedTrackId);
  const available = new Set(song.tracks.map((track) => String(track.id)));
  const trackIds = resolved.trackIds?.filter((id) => available.has(id)) ?? null;
  if (resolved.id === "selected" && !trackIds?.length) throw new RangeError("Select an instrument before exporting its track");
  const prepared = structuredClone(song);
  if (timing === "tight") {
    const totalBeats = finite(prepared.meta.totalBeats, 0);
    prepared.tracks = prepared.tracks.map((track) => ({
      ...track,
      notes: quantizeNotes(track.notes, totalBeats),
    }));
  }
  applySafeExportArticulation(prepared, { preserveSustain });
  return {
    song: prepared,
    profile: resolved,
    timing: timing === "tight" ? "tight" : "performance",
    options: {
      ...(trackIds ? { trackIds } : {}),
      ...(trackIds ? { alwaysIncludeTrackIds: trackIds } : {}),
    },
  };
}
