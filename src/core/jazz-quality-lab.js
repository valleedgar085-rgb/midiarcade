const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}

function genreOf(song) {
  return String(song?.genre ?? song?.meta?.genre ?? "").trim().toLowerCase();
}

function tracksOf(song) {
  return Array.isArray(song?.tracks) ? song.tracks : [];
}

function trackId(track) {
  return String(track?.id ?? track?.role ?? track?.name ?? "");
}

function track(song, id) {
  return tracksOf(song).find((candidate) => trackId(candidate) === String(id)) ?? null;
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time);
}

function noteDuration(note) {
  return Math.max(0.02, finite(note?.duration ?? note?.length ?? note?.durationBeats, 0.25));
}

function structureOf(song) {
  return Array.isArray(song?.structure) ? song.structure
    : Array.isArray(song?.sections) ? song.sections
      : [];
}

function sectionRange(song, sectionId) {
  const section = structureOf(song).find((candidate) => String(candidate?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar ?? section?.start) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { start, end, beatsPerBar, section };
}

function inSelection(song, note, selection = {}) {
  if (selection?.sectionId == null) return true;
  const range = sectionRange(song, selection.sectionId);
  if (!range) return false;
  const start = noteStart(note);
  return start >= range.start - EPSILON && start < range.end - EPSILON;
}

function selectedTrackIds(song, selection = {}) {
  if (selection?.target === "track" || selection?.target === "section-track") {
    return new Set([String(selection.trackId)]);
  }
  return new Set(tracksOf(song).map(trackId));
}

function notesFor(song, id, selection = {}) {
  return (track(song, id)?.notes ?? []).filter((note) => inSelection(song, note, selection));
}

function harmonyEvents(song, selection = {}) {
  const events = Array.isArray(song?.harmony) ? song.harmony : [];
  if (selection?.sectionId == null) return events;
  const range = sectionRange(song, selection.sectionId);
  if (!range) return [];
  return events.filter((event) => {
    const start = finite(event?.start ?? event?.startBeat);
    return start >= range.start - EPSILON && start < range.end - EPSILON;
  });
}

function chordRoot(event) {
  const explicit = [
    event?.rootPc,
    event?.root,
    event?.rootPitchClass,
    event?.tonicPc,
  ].find((value) => Number.isFinite(Number(value)));
  if (explicit != null) return mod12(explicit);
  return Array.isArray(event?.tones) && event.tones.length ? mod12(event.tones[0]) : null;
}

function chordClasses(event) {
  return new Set((event?.tones ?? []).map(mod12));
}

function guideToneClasses(event) {
  const root = chordRoot(event);
  const tones = chordClasses(event);
  if (root == null || !tones.size) return new Set();
  const candidates = [root + 3, root + 4, root + 10, root + 11].map(mod12);
  return new Set(candidates.filter((pitchClass) => tones.has(pitchClass)));
}

function eventEnd(event, fallback = 0) {
  return finite(event?.start ?? event?.startBeat) + Math.max(
    0.01,
    finite(event?.duration ?? event?.durationBeats, fallback),
  );
}

function activeNotes(notes, start, end) {
  return notes.filter((note) => {
    const onset = noteStart(note);
    const release = onset + noteDuration(note);
    return release > start + EPSILON && onset < end - EPSILON;
  });
}

function guideToneMetrics(song, selection) {
  const ids = selectedTrackIds(song, selection);
  const preferredRoles = ["chords", "melody", "counterpoint"].filter((id) => ids.has(id));
  const sources = preferredRoles.flatMap((id) => notesFor(song, id, selection));
  const events = harmonyEvents(song, selection).filter((event) => guideToneClasses(event).size);
  let covered = 0;
  let doubleCovered = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const start = finite(event?.start ?? event?.startBeat);
    const nextStart = finite(events[index + 1]?.start ?? events[index + 1]?.startBeat, start + 4);
    const end = Math.max(start + 0.25, Math.min(eventEnd(event, nextStart - start), nextStart));
    const guides = guideToneClasses(event);
    const sounding = new Set(activeNotes(sources, start, end).map((note) => mod12(note?.pitch ?? note?.note ?? note?.midi)));
    const matches = [...guides].filter((pitchClass) => sounding.has(pitchClass)).length;
    if (matches >= 1) covered += 1;
    if (matches >= 2) doubleCovered += 1;
  }
  const coverage = events.length ? covered / events.length : 1;
  const shellCoverage = events.length ? doubleCovered / events.length : 1;
  return Object.freeze({
    events: events.length,
    covered,
    doubleCovered,
    coverage: round(coverage),
    shellCoverage: round(shellCoverage),
    score: Math.round(clamp(coverage * 0.72 + shellCoverage * 0.28) * 100),
  });
}

function walkingBassMetrics(song, selection) {
  const bass = notesFor(song, "bass", selection)
    .slice()
    .sort((left, right) => noteStart(left) - noteStart(right));
  if (bass.length < 2) {
    return Object.freeze({
      notes: bass.length,
      beatCoverage: bass.length ? 0.25 : 0,
      stepwiseRatio: 0,
      approachRatio: 0,
      rootOnlyRatio: 1,
      score: bass.length ? 35 : 20,
    });
  }
  const beatCoverage = bass.filter((note) => Math.abs(noteStart(note) - Math.round(noteStart(note))) <= 0.09).length / bass.length;
  const intervals = bass.slice(1).map((note, index) => Math.abs(
    finite(note?.pitch ?? note?.note ?? note?.midi)
    - finite(bass[index]?.pitch ?? bass[index]?.note ?? bass[index]?.midi),
  ));
  const stepwiseRatio = intervals.filter((interval) => interval <= 3).length / Math.max(1, intervals.length);

  const events = harmonyEvents(song, selection);
  let approaches = 0;
  let opportunities = 0;
  let roots = 0;
  let chordCompared = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const root = chordRoot(event);
    if (root == null) continue;
    const start = finite(event?.start ?? event?.startBeat);
    const next = events[index + 1];
    const nextStart = finite(next?.start ?? next?.startBeat, eventEnd(event, 4));
    const eventNotes = bass.filter((note) => noteStart(note) >= start - EPSILON && noteStart(note) < nextStart - EPSILON);
    for (const note of eventNotes) {
      chordCompared += 1;
      if (mod12(note?.pitch ?? note?.note ?? note?.midi) === root) roots += 1;
    }
    if (!next) continue;
    const nextRoot = chordRoot(next);
    if (nextRoot == null) continue;
    const last = eventNotes.at(-1);
    if (!last) continue;
    opportunities += 1;
    const distance = Math.abs(
      finite(last?.pitch ?? last?.note ?? last?.midi)
      - finite(bass.find((note) => noteStart(note) >= nextStart - 0.08)?.pitch, finite(last?.pitch)),
    );
    const pcDistance = Math.min(
      Math.abs(mod12(last?.pitch) - nextRoot),
      12 - Math.abs(mod12(last?.pitch) - nextRoot),
    );
    if (distance <= 3 || pcDistance <= 2) approaches += 1;
  }
  const approachRatio = opportunities ? approaches / opportunities : 0.5;
  const rootOnlyRatio = chordCompared ? roots / chordCompared : 1;
  const antiRootScore = clamp(1 - Math.max(0, rootOnlyRatio - 0.52) / 0.48);
  const score = Math.round(clamp(
    beatCoverage * 0.28
    + stepwiseRatio * 0.28
    + approachRatio * 0.28
    + antiRootScore * 0.16,
  ) * 100);
  return Object.freeze({
    notes: bass.length,
    beatCoverage: round(beatCoverage),
    stepwiseRatio: round(stepwiseRatio),
    approachRatio: round(approachRatio),
    rootOnlyRatio: round(rootOnlyRatio),
    score,
  });
}

function swingMetrics(song, selection) {
  const ids = selectedTrackIds(song, selection);
  const notes = ["drums", "bass", "melody", "counterpoint"]
    .filter((id) => ids.has(id) || selection?.target === "song" || selection?.target === "section")
    .flatMap((id) => notesFor(song, id, selection));
  if (!notes.length) return Object.freeze({ notes: 0, offbeatRatio: 0, swingZoneRatio: 0, score: 25 });
  let offbeat = 0;
  let swingZone = 0;
  for (const note of notes) {
    const fraction = ((noteStart(note) % 1) + 1) % 1;
    if (Math.min(fraction, 1 - fraction) > 0.09) offbeat += 1;
    if (
      Math.abs(fraction - 1 / 3) <= 0.11
      || Math.abs(fraction - 2 / 3) <= 0.11
      || (fraction >= 0.56 && fraction <= 0.74)
    ) swingZone += 1;
  }
  const offbeatRatio = offbeat / notes.length;
  const swingZoneRatio = offbeat ? swingZone / offbeat : 0;
  const offbeatFit = clamp(1 - Math.abs(offbeatRatio - 0.48) / 0.48);
  const score = Math.round(clamp(offbeatFit * 0.45 + swingZoneRatio * 0.55) * 100);
  return Object.freeze({
    notes: notes.length,
    offbeatRatio: round(offbeatRatio),
    swingZoneRatio: round(swingZoneRatio),
    score,
  });
}

function compingMetrics(song, selection) {
  const notes = notesFor(song, "chords", selection);
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const ranges = selection?.sectionId != null
    ? [sectionRange(song, selection.sectionId)].filter(Boolean)
    : structureOf(song).map((section) => sectionRange(song, section.id)).filter(Boolean);
  const totalBeats = ranges.length
    ? ranges.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0)
    : Math.max(beatsPerBar, finite(song?.meta?.bars, 1) * beatsPerBar);
  const bars = Math.max(1, totalBeats / beatsPerBar);
  const onsets = [...new Set(notes.map((note) => round(noteStart(note), 2)))].sort((a, b) => a - b);
  const attacksPerBar = onsets.length / bars;
  const offbeatRatio = onsets.length
    ? onsets.filter((start) => Math.abs(start - Math.round(start)) > 0.09).length / onsets.length
    : 0;
  const spacingFit = attacksPerBar >= 0.6 && attacksPerBar <= 4.5
    ? 1
    : clamp(1 - Math.abs(attacksPerBar - 2.2) / 5);
  const score = Math.round(clamp(spacingFit * 0.62 + clamp(offbeatRatio / 0.45) * 0.38) * 100);
  return Object.freeze({
    notes: notes.length,
    attacks: onsets.length,
    attacksPerBar: round(attacksPerBar),
    offbeatRatio: round(offbeatRatio),
    score,
  });
}

function phraseMetrics(song, selection) {
  const melody = notesFor(song, "melody", selection)
    .slice()
    .sort((left, right) => noteStart(left) - noteStart(right));
  if (melody.length < 2) return Object.freeze({ notes: melody.length, continuity: 0, cadenceFit: 0, score: 25 });
  const intervals = melody.slice(1).map((note, index) => Math.abs(
    finite(note?.pitch ?? note?.note ?? note?.midi)
    - finite(melody[index]?.pitch ?? melody[index]?.note ?? melody[index]?.midi),
  ));
  const continuity = intervals.filter((interval) => interval <= 7).length / intervals.length;
  const ranges = selection?.sectionId != null
    ? [sectionRange(song, selection.sectionId)].filter(Boolean)
    : structureOf(song).map((section) => sectionRange(song, section.id)).filter(Boolean);
  let cadenceCompared = 0;
  let cadenceHits = 0;
  for (const range of ranges) {
    const ending = melody
      .filter((note) => noteStart(note) >= range.end - range.beatsPerBar - EPSILON && noteStart(note) < range.end + EPSILON)
      .at(-1);
    if (!ending) continue;
    const event = [...(song?.harmony ?? [])]
      .reverse()
      .find((item) => finite(item?.start ?? item?.startBeat) <= noteStart(ending) + EPSILON);
    const classes = chordClasses(event);
    if (!classes.size) continue;
    cadenceCompared += 1;
    if (classes.has(mod12(ending?.pitch ?? ending?.note ?? ending?.midi))) cadenceHits += 1;
  }
  const cadenceFit = cadenceCompared ? cadenceHits / cadenceCompared : 0.75;
  const score = Math.round(clamp(continuity * 0.58 + cadenceFit * 0.42) * 100);
  return Object.freeze({
    notes: melody.length,
    continuity: round(continuity),
    cadenceCompared,
    cadenceFit: round(cadenceFit),
    score,
  });
}

function chromaticResolutionMetrics(song, selection) {
  const keyPc = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) {
    return Object.freeze({ chromaticNotes: 0, resolved: 0, resolutionRatio: 1, score: 100 });
  }
  const allowed = new Set(intervals.map((interval) => mod12(keyPc + Number(interval))));
  const ids = selectedTrackIds(song, selection);
  const roles = ["bass", "melody", "counterpoint"].filter((id) => ids.has(id));
  let chromaticNotes = 0;
  let resolved = 0;
  for (const id of roles) {
    const notes = notesFor(song, id, selection).slice().sort((a, b) => noteStart(a) - noteStart(b));
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      if (allowed.has(mod12(note?.pitch ?? note?.note ?? note?.midi))) continue;
      chromaticNotes += 1;
      const next = notes[index + 1];
      if (!next || noteStart(next) - noteStart(note) > 0.8) continue;
      const movement = Math.abs(finite(next?.pitch) - finite(note?.pitch));
      if (movement <= 2 && allowed.has(mod12(next?.pitch))) resolved += 1;
    }
  }
  const resolutionRatio = chromaticNotes ? resolved / chromaticNotes : 1;
  return Object.freeze({
    chromaticNotes,
    resolved,
    resolutionRatio: round(resolutionRatio),
    score: Math.round(clamp(resolutionRatio) * 100),
  });
}

export function analyzeJazzQuality(song, selection = {}) {
  if (genreOf(song) !== "jazz") return null;
  const guideTones = guideToneMetrics(song, selection);
  const walkingBass = walkingBassMetrics(song, selection);
  const swing = swingMetrics(song, selection);
  const comping = compingMetrics(song, selection);
  const phrase = phraseMetrics(song, selection);
  const chromaticism = chromaticResolutionMetrics(song, selection);
  const overall = Math.round(
    guideTones.score * 0.24
    + walkingBass.score * 0.22
    + swing.score * 0.18
    + comping.score * 0.14
    + phrase.score * 0.16
    + chromaticism.score * 0.06
  );
  return Object.freeze({
    version: 1,
    guideTones,
    walkingBass,
    swing,
    comping,
    phrase,
    chromaticism,
    scores: Object.freeze({
      guideTones: guideTones.score,
      walkingBass: walkingBass.score,
      swing: swing.score,
      comping: comping.score,
      phrase: phrase.score,
      chromaticism: chromaticism.score,
      overall,
    }),
  });
}

export function compareJazzQuality(before, after, selection = {}) {
  const baseline = analyzeJazzQuality(before, selection);
  const candidate = analyzeJazzQuality(after, selection);
  if (!baseline || !candidate) return null;
  const hardIssues = [];
  const warnings = [];
  const regress = (metric, hardDrop, floor, issue) => {
    const left = finite(baseline.scores?.[metric], 100);
    const right = finite(candidate.scores?.[metric], 100);
    if (right < left - hardDrop && right < floor) hardIssues.push(issue);
    else if (right < left - Math.max(5, hardDrop * 0.55)) warnings.push(`warning:${issue}`);
  };
  regress("guideTones", 18, 52, "jazz:guide-tone-regression");
  regress("walkingBass", 20, 48, "jazz:walking-bass-regression");
  regress("swing", 22, 42, "jazz:swing-regression");
  regress("comping", 24, 38, "jazz:comping-regression");
  regress("phrase", 20, 48, "jazz:phrase-regression");
  if (
    candidate.chromaticism.chromaticNotes > 0
    && candidate.chromaticism.resolutionRatio < 0.8
    && candidate.chromaticism.resolutionRatio < baseline.chromaticism.resolutionRatio - 0.15
  ) hardIssues.push("jazz:unresolved-chromaticism");
  if (candidate.scores.overall < baseline.scores.overall - 14 && candidate.scores.overall < 55) {
    hardIssues.push("jazz:quality-regression");
  }
  return Object.freeze({
    version: 1,
    baseline,
    candidate,
    hardIssues: Object.freeze([...new Set(hardIssues)]),
    warnings: Object.freeze([...new Set(warnings)]),
    deltas: Object.freeze(Object.fromEntries(
      Object.keys(candidate.scores).map((key) => [
        key,
        finite(candidate.scores[key]) - finite(baseline.scores[key]),
      ]),
    )),
  });
}
