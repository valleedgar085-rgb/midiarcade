function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function eventStart(event) {
  return finite(event?.start ?? event?.startBeat ?? event?.beat ?? event?.time ?? event?.tick, 0);
}

function setEventStart(event, value) {
  const key = ["start", "startBeat", "beat", "time", "tick"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(event, candidate)
  )) || "start";
  event[key] = value;
}

function eventPitch(event) {
  return finite(event?.pitch ?? event?.note ?? event?.midi, 60);
}

function setEventPitch(event, value) {
  const key = ["pitch", "note", "midi"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(event, candidate)
  )) || "pitch";
  event[key] = value;
}

function eventVelocity(event) {
  const value = finite(event?.velocity ?? event?.vel, 90);
  return value <= 1 ? Math.round(value * 127) : value;
}

function setEventVelocity(event, value) {
  const key = Object.prototype.hasOwnProperty.call(event, "vel") ? "vel" : "velocity";
  event[key] = finite(event?.[key], 90) <= 1 ? value / 127 : value;
}

function sectionStartBeat(section, beatsPerBar) {
  return finite(section?.startBeat, finite(section?.startBar, finite(section?.start, 0)) * beatsPerBar);
}

function sectionBars(section) {
  return Math.max(1, Math.round(finite(section?.bars, 1)));
}

function arrangementPayload(song) {
  return JSON.stringify({
    bars: song?.bars,
    meta: {
      bars: song?.meta?.bars,
      totalBeats: song?.meta?.totalBeats,
      beatsPerBar: song?.meta?.beatsPerBar,
    },
    structure: song?.structure,
    sections: song?.sections,
    tracks: song?.tracks,
    harmony: song?.harmony,
    sectionPlans: song?.songBlueprint?.sectionPlans,
  });
}

/**
 * Verify the timing contract required by playback, rendering, and MIDI export.
 */
export function validateArrangementSong(song) {
  const sections = song?.structure ?? song?.sections;
  const tracks = song?.tracks;
  const beatsPerBar = finite(song?.meta?.beatsPerBar, 4);
  if (!song || !Array.isArray(sections) || !sections.length || !Array.isArray(tracks) || beatsPerBar <= 0) {
    return { valid: false, error: "invalid-song-shape" };
  }

  const ids = new Set();
  let cursorBars = 0;
  for (const section of sections) {
    const id = String(section?.id ?? "");
    const bars = sectionBars(section);
    if (!id || ids.has(id)) return { valid: false, error: "invalid-section-identity" };
    if (Math.abs(sectionStartBeat(section, beatsPerBar) - cursorBars * beatsPerBar) > 1e-6) {
      return { valid: false, error: "noncontiguous-sections" };
    }
    ids.add(id);
    cursorBars += bars;
  }

  const totalBeats = cursorBars * beatsPerBar;
  if (Math.abs(finite(song?.meta?.totalBeats, -1) - totalBeats) > 1e-6) {
    return { valid: false, error: "invalid-song-duration" };
  }
  const validTimedEvent = (event, { note = false } = {}) => {
    const start = eventStart(event);
    const duration = finite(event?.duration ?? event?.length, note ? -1 : 0);
    if (start < -1e-7 || start >= totalBeats + 1e-7) return false;
    if (note && (duration <= 0 || start + duration > totalBeats + 1e-6)) return false;
    if (duration > 0 && start + duration > totalBeats + 1e-6) return false;
    const pitch = event?.pitch ?? event?.note ?? event?.midi;
    if (pitch != null && (finite(pitch, -1) < 0 || finite(pitch, 128) > 127)) return false;
    return true;
  };
  for (const track of tracks) {
    if (!Array.isArray(track?.notes) || !track.notes.every((event) => validTimedEvent(event, { note: true }))) {
      return { valid: false, error: "invalid-track-events" };
    }
    if (track.automation != null && (
      !Array.isArray(track.automation)
      || !track.automation.every((event) => validTimedEvent(event))
    )) return { valid: false, error: "invalid-automation-events" };
  }
  if (song.harmony != null && (
    !Array.isArray(song.harmony)
    || !song.harmony.every((event) => validTimedEvent(event))
  )) return { valid: false, error: "invalid-harmony-events" };
  return { valid: true, totalBars: cursorBars, totalBeats };
}

/**
 * Repair only derived section timing and duration metadata. Musical events,
 * section identity, and note content are never invented or discarded here.
 */
export function repairArrangementTiming(sourceSong) {
  if (!sourceSong || typeof sourceSong !== "object") return null;
  const sourceSections = sourceSong.structure ?? sourceSong.sections;
  if (!Array.isArray(sourceSections) || !sourceSections.length || !Array.isArray(sourceSong.tracks)) return null;
  const ids = sourceSections.map((section) => String(section?.id ?? ""));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return null;

  const song = clone(sourceSong);
  const beatsPerBar = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  const sections = clone(sourceSections);
  let cursorBars = 0;
  for (const section of sections) {
    const bars = sectionBars(section);
    section.start = cursorBars;
    section.startBar = cursorBars;
    section.startBeat = cursorBars * beatsPerBar;
    section.endBeat = (cursorBars + bars) * beatsPerBar;
    cursorBars += bars;
  }
  song.structure = sections;
  song.sections = clone(sections);
  song.bars = cursorBars;
  song.meta = {
    ...(song.meta || {}),
    bars: cursorBars,
    beatsPerBar,
    totalBeats: cursorBars * beatsPerBar,
  };
  return validateArrangementSong(song).valid ? song : null;
}

function uniqueSectionId(sections, base) {
  const ids = new Set(sections.map((section) => String(section.id)));
  let suffix = 2;
  let candidate = `${base}-copy`;
  while (ids.has(candidate)) candidate = `${base}-copy-${suffix++}`;
  return candidate;
}

function duplicateTimedEvents(events, sourceStart, sourceEnd, insertionBeat, beatLength) {
  if (!Array.isArray(events)) return events;
  const output = [];
  for (const original of events) {
    const event = clone(original);
    const start = eventStart(original);
    if (start >= insertionBeat - 1e-7) setEventStart(event, start + beatLength);
    output.push(event);
    if (start >= sourceStart - 1e-7 && start < sourceEnd - 1e-7) {
      const copy = clone(original);
      setEventStart(copy, start + beatLength);
      output.push(copy);
    }
  }
  return output.sort((left, right) => eventStart(left) - eventStart(right));
}

/**
 * Duplicate one complete section while keeping every MIDI, automation, and
 * harmony event aligned. Returns null when the operation would exceed maxBars.
 */
export function duplicateSongSection(sourceSong, sectionId, { maxBars = 64 } = {}) {
  if (!sourceSong || typeof sourceSong !== "object") return null;
  const sourceSections = sourceSong.structure ?? sourceSong.sections;
  if (!Array.isArray(sourceSections) || !sourceSections.length) return null;
  const sourceIndex = sourceSections.findIndex((section) => String(section.id) === String(sectionId));
  if (sourceIndex < 0) return null;

  const beatsPerBar = Math.max(1, finite(sourceSong.meta?.beatsPerBar, 4));
  const selected = sourceSections[sourceIndex];
  const bars = sectionBars(selected);
  const totalBars = sourceSections.reduce((sum, section) => sum + sectionBars(section), 0);
  if (totalBars + bars > Math.max(1, finite(maxBars, 64))) return null;

  const song = clone(sourceSong);
  const sections = clone(sourceSections);
  const duplicateId = uniqueSectionId(sections, String(selected.id || `section-${sourceIndex + 1}`));
  const sourceStart = sectionStartBeat(selected, beatsPerBar);
  const beatLength = bars * beatsPerBar;
  const sourceEnd = sourceStart + beatLength;
  const duplicate = {
    ...clone(selected),
    id: duplicateId,
    name: `${String(selected.name || "Section")} Variation`,
  };
  sections.splice(sourceIndex + 1, 0, duplicate);

  let cursorBars = 0;
  for (const section of sections) {
    const length = sectionBars(section);
    section.start = cursorBars;
    section.startBar = cursorBars;
    section.startBeat = cursorBars * beatsPerBar;
    section.endBeat = (cursorBars + length) * beatsPerBar;
    cursorBars += length;
  }
  song.structure = sections;
  song.sections = clone(sections);
  song.bars = cursorBars;
  song.meta = { ...(song.meta || {}), bars: cursorBars, totalBeats: cursorBars * beatsPerBar };

  song.tracks = (song.tracks ?? []).map((track) => ({
    ...track,
    notes: duplicateTimedEvents(track.notes, sourceStart, sourceEnd, sourceEnd, beatLength),
    automation: duplicateTimedEvents(track.automation, sourceStart, sourceEnd, sourceEnd, beatLength),
  }));
  song.harmony = duplicateTimedEvents(song.harmony, sourceStart, sourceEnd, sourceEnd, beatLength);

  const plans = song.songBlueprint?.sectionPlans;
  if (Array.isArray(plans)) {
    const planIndex = plans.findIndex((plan) => String(plan.sectionId) === String(sectionId));
    if (planIndex >= 0) {
      const plan = { ...clone(plans[planIndex]), sectionId: duplicateId, role: "developed-return" };
      plans.splice(planIndex + 1, 0, plan);
    }
  }
  song.manualArrangement = {
    ...(song.manualArrangement || {}),
    lastAction: "duplicate-section",
    sourceSectionId: String(sectionId),
    duplicateSectionId: duplicateId,
  };
  return { song, duplicateId };
}

function relocateSongSections(sourceSong, sectionId, targetIndex) {
  const sourceSections = sourceSong?.structure ?? sourceSong?.sections;
  if (!Array.isArray(sourceSections) || sourceSections.length < 2) return null;
  const currentIndex = sourceSections.findIndex((section) => String(section.id) === String(sectionId));
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sourceSections.length) return null;
  if (currentIndex === targetIndex) return { song: clone(sourceSong), focusSectionId: String(sectionId) };

  const song = clone(sourceSong);
  const beatsPerBar = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  const original = clone(sourceSections);
  const reordered = clone(sourceSections);
  const [selected] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, selected);
  let cursorBars = 0;
  for (const section of reordered) {
    const bars = sectionBars(section);
    section.start = cursorBars;
    section.startBar = cursorBars;
    section.startBeat = cursorBars * beatsPerBar;
    section.endBeat = (cursorBars + bars) * beatsPerBar;
    cursorBars += bars;
  }
  const destinationById = new Map(reordered.map((section) => [String(section.id), section]));
  const sourceForBeat = (beat) => original.find((section) => {
    const start = sectionStartBeat(section, beatsPerBar);
    return beat >= start - 1e-7 && beat < start + sectionBars(section) * beatsPerBar - 1e-7;
  });
  const relocate = (event) => {
    const source = sourceForBeat(eventStart(event));
    const destination = destinationById.get(String(source?.id));
    if (!source || !destination) return;
    setEventStart(event, eventStart(event) + destination.startBeat - sectionStartBeat(source, beatsPerBar));
  };
  song.tracks = (song.tracks ?? []).map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => {
      const next = clone(note);
      relocate(next);
      return next;
    }).sort((left, right) => eventStart(left) - eventStart(right)),
    automation: (track.automation ?? []).map((event) => {
      const next = clone(event);
      relocate(next);
      return next;
    }).sort((left, right) => eventStart(left) - eventStart(right)),
  }));
  song.harmony = (song.harmony ?? []).map((event) => {
    const next = clone(event);
    relocate(next);
    return next;
  }).sort((left, right) => eventStart(left) - eventStart(right));
  song.structure = reordered;
  song.sections = clone(reordered);
  song.manualArrangement = {
    ...(song.manualArrangement || {}),
    lastAction: "reorder-section",
    sectionId: String(sectionId),
    targetIndex,
  };
  return { song, focusSectionId: String(sectionId) };
}

function transformSongSection(sourceSong, sectionId, operation, value) {
  const sourceSections = sourceSong?.structure ?? sourceSong?.sections;
  const section = sourceSections?.find?.((candidate) => String(candidate.id) === String(sectionId));
  if (!section) return null;
  const song = clone(sourceSong);
  const beatsPerBar = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  const rangeStart = sectionStartBeat(section, beatsPerBar);
  const rangeEnd = rangeStart + sectionBars(section) * beatsPerBar;
  const inRange = (note) => eventStart(note) >= rangeStart - 1e-7 && eventStart(note) < rangeEnd - 1e-7;
  const tracks = Array.isArray(song.tracks) ? song.tracks : [];
  const entries = tracks.flatMap((track) => (
    (track.notes ?? []).filter(inRange).map((note) => ({ note, track }))
  ));
  if (!entries.length) return null;

  if (operation === "energy") {
    const target = { low: 68, balanced: 88, high: 110 }[value] ?? 88;
    const average = entries.reduce((sum, { note }) => sum + eventVelocity(note), 0) / entries.length;
    const factor = target / Math.max(1, average);
    entries.forEach(({ note }) => setEventVelocity(note, Math.min(120, Math.max(1, Math.round(eventVelocity(note) * factor)))));
  } else if (operation === "simplify" || (operation === "density" && value === "sparse")) {
    for (const track of tracks) {
      if (!["melody", "counterpoint", "chords", "pad"].includes(String(track.id))) continue;
      let sectionIndex = 0;
      track.notes = (track.notes ?? []).filter((note) => !inRange(note) || sectionIndex++ % 3 !== 1);
    }
  } else if (operation === "density" && value === "rich") {
    for (const track of tracks) {
      if (String(track.id) === "drums") continue;
      const additions = (track.notes ?? []).filter(inRange).filter((_, index) => index % 5 === 0).slice(0, 24).flatMap((note) => {
        const start = eventStart(note) + 0.5;
        if (start >= rangeEnd - 0.05) return [];
        const copy = clone(note);
        setEventStart(copy, start);
        setEventVelocity(copy, Math.max(1, eventVelocity(copy) - (track.id === "bass" ? 10 : 16)));
        return [copy];
      });
      track.notes.push(...additions);
      track.notes.sort((left, right) => eventStart(left) - eventStart(right));
    }
  } else if (operation === "tension") {
    const delta = value === "charged" ? 12 : value === "open" ? -12 : 0;
    entries.filter(({ track }) => ["melody", "counterpoint"].includes(String(track.id)))
      .forEach(({ note }) => setEventPitch(note, Math.min(116, Math.max(24, eventPitch(note) + delta))));
  } else if (operation === "pocket") {
    const offset = value === "relaxed" ? 0.025 : value === "pushed" ? -0.025 : 0;
    entries.forEach(({ note, track }) => {
      const start = value === "tight"
        ? Math.round(eventStart(note) * 4) / 4
        : eventStart(note) + (track.id === "drums" ? offset * 0.4 : offset);
      setEventStart(note, Math.min(rangeEnd - 0.02, Math.max(rangeStart, start)));
    });
  } else if (operation === "build") {
    entries.forEach(({ note }) => {
      const progress = Math.min(1, Math.max(0, (eventStart(note) - rangeStart) / Math.max(1, rangeEnd - rangeStart)));
      setEventVelocity(note, Math.min(120, Math.max(1, Math.round(eventVelocity(note) * (0.84 + progress * 0.3)))));
    });
  } else if (operation !== "density") {
    return null;
  }
  song.manualArrangement = {
    ...(song.manualArrangement || {}),
    lastAction: "transform-section",
    sectionId: String(sectionId),
    operation,
    value,
  };
  return { song, focusSectionId: String(sectionId) };
}

/**
 * The single immutable boundary for every Shape arrangement mutation.
 */
export function executeArrangementCommand(sourceSong, command = {}) {
  if (!sourceSong || typeof sourceSong !== "object" || !command || typeof command !== "object") {
    return { changed: false, error: "invalid-command" };
  }
  let workingSong = sourceSong;
  let sourceValidation = validateArrangementSong(workingSong);
  let repaired = false;
  if (!sourceValidation.valid && ["noncontiguous-sections", "invalid-song-duration"].includes(sourceValidation.error)) {
    const repairedSong = repairArrangementTiming(sourceSong);
    if (repairedSong) {
      workingSong = repairedSong;
      sourceValidation = validateArrangementSong(workingSong);
      repaired = true;
    }
  }
  if (!sourceValidation.valid) return { changed: false, error: sourceValidation.error, command: clone(command) };
  const transformValues = {
    energy: new Set(["low", "balanced", "high"]),
    density: new Set(["sparse", "balanced", "rich"]),
    tension: new Set(["open", "balanced", "charged"]),
    pocket: new Set(["relaxed", "tight", "pushed"]),
    simplify: new Set([undefined]),
    build: new Set([undefined]),
  };
  if (command.type === "transform" && (
    !transformValues[command.operation]
    || !transformValues[command.operation].has(command.value)
  )) {
    return { changed: false, error: "invalid-transform", command: clone(command) };
  }
  let result = null;
  if (command.type === "duplicate") {
    const duplicated = duplicateSongSection(workingSong, command.sectionId, { maxBars: command.maxBars ?? 64 });
    result = duplicated && { song: duplicated.song, focusSectionId: duplicated.duplicateId };
  }
  if (command.type === "reorder") {
    result = relocateSongSections(workingSong, command.sectionId, Math.round(finite(command.targetIndex, -1)));
  }
  if (command.type === "transform") {
    result = transformSongSection(workingSong, command.sectionId, command.operation, command.value);
  }
  if (!result) return { changed: false, error: "command-rejected", command: clone(command) };
  if (arrangementPayload(sourceSong) === arrangementPayload(result.song)) {
    return { changed: false, error: "no-musical-change", command: clone(command) };
  }
  const validation = validateArrangementSong(result.song);
  return validation.valid
    ? { ...result, changed: true, command: clone(command), validation, repaired }
    : { changed: false, error: validation.error, command: clone(command) };
}
