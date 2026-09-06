function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function audibleNotes(track) {
  if (!track || track.settings?.mute) return [];
  return (track.notes ?? []).filter((note) => (
    Number.isFinite(Number(note?.start))
    && finite(note?.duration, 0) > 0
    && finite(note?.velocity, 0) > 0
  ));
}

function clusteredAttacks(notes, tolerance = 0.055) {
  const starts = notes.map((note) => finite(note.start)).sort((left, right) => left - right);
  if (!starts.length) return 0;
  let attacks = 1;
  let clusterStart = starts[0];
  for (const start of starts.slice(1)) {
    if (start - clusterStart <= tolerance) continue;
    attacks += 1;
    clusterStart = start;
  }
  return attacks;
}

/**
 * Measure the rhythmic texture a listener hears rather than counting chord
 * noteheads as unrelated events. Drums and monophonic/lead parts retain every
 * attack; chord and pad stacks are grouped into one musical onset.
 */
export function measureMusicalDensity(song = {}) {
  const perTrackEvents = {};
  let totalEvents = 0;
  for (const track of song.tracks ?? []) {
    const notes = audibleNotes(track);
    const events = ["chords", "pad"].includes(track.id)
      ? clusteredAttacks(notes)
      : notes.length;
    perTrackEvents[track.id] = events;
    totalEvents += events;
  }
  const structureBars = (song.structure ?? []).reduce(
    (maximum, section) => Math.max(maximum, finite(section?.startBar) + finite(section?.bars)),
    0,
  );
  const bars = Math.max(1, finite(song.meta?.bars, finite(song.bars, structureBars || 1)));
  return Object.freeze({
    version: 1,
    bars,
    totalEvents,
    eventsPerBar: Number((totalEvents / bars).toFixed(3)),
    perTrackEvents: Object.freeze(perTrackEvents),
  });
}
