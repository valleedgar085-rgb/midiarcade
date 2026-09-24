import { cloneValue } from "./clone-value.js";

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, fallback = null) {
  return value == null || value === "" ? fallback : String(value);
}

function makeId(...parts) {
  return parts.filter((part) => part != null && part !== "").map(String).join(":");
}

function sectionId(section, index) {
  return text(section?.id ?? section?.sectionId, `section-${index + 1}`);
}

function collectTracks(song = {}) {
  if (Array.isArray(song.tracks)) return song.tracks;
  const candidates = [
    ["drums", song.drums],
    ["bass", song.bass],
    ["chords", song.chords],
    ["melody", song.melody],
    ["counterline", song.counterline],
    ["arp", song.arp],
    ["atmosphere", song.atmosphere],
  ];
  return candidates
    .filter(([, value]) => value != null)
    .map(([role, value]) => ({ role, ...((value && typeof value === "object") ? value : { events: value }) }));
}

function collectEvents(track = {}) {
  for (const key of ["events", "notes", "musicalEvents"]) {
    if (Array.isArray(track?.[key])) return track[key];
  }
  return [];
}

export function buildGenerationPersistenceSnapshot({
  runId,
  songId,
  kind = "new",
  config = {},
  song = {},
  engineVersion = null,
  startedAt = null,
  completedAt = null,
} = {}) {
  if (!runId) throw new TypeError("generation persistence requires runId");
  if (!songId) throw new TypeError("generation persistence requires songId");

  const safeSong = cloneValue(song) ?? {};
  const blueprint = safeSong.songBlueprint ?? safeSong.songPlan ?? null;
  const groove = safeSong.grooveConductor ?? null;
  const harmony = safeSong.harmony ?? null;
  const sections = safeSong.structure ?? safeSong.sections ?? [];
  const tracks = collectTracks(safeSong);

  const run = {
    id: String(runId),
    songId: String(songId),
    kind: String(kind),
    seed: text(config.seed ?? safeSong.seed),
    genre: text(config.genre ?? safeSong.genre ?? safeSong.meta?.genre),
    requestedBars: finite(config.bars ?? safeSong.meta?.bars),
    engineVersion: text(engineVersion),
    startedAt: text(startedAt),
    completedAt: text(completedAt),
    config: cloneValue(config) ?? {},
  };

  const sectionRows = (Array.isArray(sections) ? sections : []).map((section, index) => ({
    id: makeId(runId, "section", sectionId(section, index)),
    generationRunId: String(runId),
    sectionId: sectionId(section, index),
    ordinal: index,
    section: cloneValue(section),
  }));

  const trackRows = tracks.map((track, index) => {
    const role = text(track?.role ?? track?.id ?? track?.name, `track-${index + 1}`);
    return {
      id: makeId(runId, "track", role, index),
      generationRunId: String(runId),
      role,
      track: cloneValue(track),
    };
  });

  const eventRows = [];
  trackRows.forEach((trackRow, trackIndex) => {
    const sourceTrack = tracks[trackIndex];
    collectEvents(sourceTrack).forEach((event, eventIndex) => {
      eventRows.push({
        id: makeId(trackRow.id, "event", eventIndex),
        trackId: trackRow.id,
        startBeat: finite(event?.startBeat ?? event?.time ?? event?.start, 0),
        durationBeats: finite(event?.durationBeats ?? event?.duration ?? event?.length, 0),
        pitch: finite(event?.pitch ?? event?.note),
        velocity: finite(event?.velocity),
        event: cloneValue(event),
      });
    });
  });

  return Object.freeze({
    run,
    blueprint: blueprint == null ? null : {
      id: makeId(runId, "blueprint"),
      generationRunId: String(runId),
      blueprint: cloneValue(blueprint),
    },
    grooveDna: groove == null ? null : {
      id: makeId(runId, "groove"),
      generationRunId: String(runId),
      genre: text(run.genre),
      subdivision: finite(groove?.subdivision),
      groove: cloneValue(groove),
    },
    harmony: harmony == null ? null : {
      id: makeId(runId, "harmony"),
      generationRunId: String(runId),
      harmony: cloneValue(harmony),
    },
    sections: sectionRows,
    tracks: trackRows,
    musicalEvents: eventRows,
  });
}
