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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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

export function prepareMidiExport(song, { profile = "full", timing = "performance", selectedTrackId = null } = {}) {
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

