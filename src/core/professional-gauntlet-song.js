import { cloneValue } from "./clone-value.js";
import { canonicalMidiPitch } from "./pitch-contract.js";

export const PROFESSIONAL_GAUNTLET_ROLE_IDS = Object.freeze([
  "drums",
  "bass",
  "chords",
  "lead",
  "counter",
  "arp",
  "fx",
]);

const ROLE_ALIASES = Object.freeze({
  drums: Object.freeze(["drums", "drum", "percussion"]),
  bass: Object.freeze(["bass", "808", "sub"]),
  chords: Object.freeze(["chords", "keys", "piano", "harmony"]),
  lead: Object.freeze(["lead", "melody", "melodic"]),
  counter: Object.freeze(["counter", "counterpoint", "counterline"]),
  arp: Object.freeze(["arp", "arpeggio", "arpeggiator"]),
  fx: Object.freeze(["fx", "atmosphere", "pad", "texture", "transition"]),
});

const PITCH_CLASS_NAMES = Object.freeze([
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
]);

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const number = finite(value, 0);
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function normalizedTrackId(track) {
  return String(track?.id ?? track?.trackId ?? track?.name ?? "").trim();
}

function normalizedRoleId(track) {
  const id = normalizedTrackId(track).toLowerCase();
  for (const roleId of PROFESSIONAL_GAUNTLET_ROLE_IDS) {
    if (ROLE_ALIASES[roleId].some((alias) => id === alias || id.includes(alias))) return roleId;
  }
  return "fx";
}

function beatsPerBarOf(song) {
  return Math.max(1, finite(song?.meta?.beatsPerBar, 4));
}

function totalBeatsOf(song) {
  const beatsPerBar = beatsPerBarOf(song);
  const bars = Math.max(1, finite(song?.meta?.bars, 1));
  return round(beatsPerBar * bars);
}

function sourceSections(song) {
  const sections = song?.structure ?? song?.sections ?? [];
  return Array.isArray(sections) ? sections : [];
}

function sectionBounds(section, song, index = 0) {
  const beatsPerBar = beatsPerBarOf(song);
  const start = finite(
    section?.startBeat,
    finite(section?.start, finite(section?.startBar, index) * beatsPerBar),
  );
  const duration = finite(
    section?.duration,
    finite(section?.beats, finite(section?.bars, 1) * beatsPerBar),
  );
  const end = finite(section?.endBeat, start + Math.max(0, duration));
  return {
    start: round(start),
    duration: round(Math.max(0, end - start)),
    end: round(end),
  };
}

function normalizeSections(song) {
  return sourceSections(song).map((section, index) => {
    const bounds = sectionBounds(section, song, index);
    return Object.freeze({
      id: String(section?.id ?? `section-${index + 1}`),
      name: String(section?.name ?? section?.label ?? section?.id ?? `Section ${index + 1}`),
      time: bounds.start,
      duration: bounds.duration,
      end: bounds.end,
      role: String(section?.intent?.role ?? section?.role ?? "development"),
      cadence: section?.intent?.cadence ?? section?.cadence ?? null,
      energy: finite(section?.intensity, finite(section?.intent?.energy, null)),
      tension: finite(section?.intent?.tension, null),
    });
  });
}

function normalizeHarmonyTimeline(song) {
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  const beatsPerBar = beatsPerBarOf(song);
  return harmony.map((entry, index) => {
    const time = finite(
      entry?.start,
      finite(entry?.startBeat, finite(entry?.beat, finite(entry?.bar, index) * beatsPerBar)),
    );
    const duration = Math.max(
      0,
      finite(entry?.duration, finite(entry?.beats, beatsPerBar)),
    );
    const pitches = entry?.pitches ?? entry?.notes ?? entry?.voicing ?? [];
    return Object.freeze({
      id: String(entry?.id ?? `harmony-${index + 1}`),
      time: round(time),
      duration: round(duration),
      end: round(time + duration),
      chord: entry?.symbol ?? entry?.name ?? entry?.chord ?? entry?.label ?? null,
      root: entry?.root ?? entry?.rootPc ?? null,
      quality: entry?.quality ?? entry?.type ?? null,
      pitches: Object.freeze(
        Array.isArray(pitches)
          ? pitches.map((pitch) => canonicalMidiPitch(pitch)).filter(Number.isFinite)
          : [],
      ),
      source: cloneValue(entry),
    });
  }).sort((left, right) => left.time - right.time);
}

function normalizeGrooveTimeline(song) {
  const beatsPerBar = beatsPerBarOf(song);
  const bars = Array.isArray(song?.grooveConductor?.bars) ? song.grooveConductor.bars : [];
  return bars.map((bar, index) => {
    const barIndex = Math.max(0, Math.round(finite(bar?.bar, index)));
    return Object.freeze({
      id: String(bar?.id ?? `groove-bar-${barIndex + 1}`),
      bar: barIndex,
      time: round(barIndex * beatsPerBar),
      duration: round(beatsPerBar),
      sectionId: bar?.sectionId ?? null,
      role: bar?.role ?? null,
      anchors: Object.freeze(cloneValue(bar?.anchors ?? [])),
      answers: Object.freeze(cloneValue(bar?.answers ?? [])),
      chordPulses: Object.freeze(cloneValue(bar?.chordPulses ?? [])),
      counterPulses: Object.freeze(cloneValue(bar?.counterPulses ?? [])),
      feel: song?.grooveConductor?.feel ?? song?.grooveConductor?.id ?? null,
    });
  }).sort((left, right) => left.time - right.time);
}

function roleAuthority(song) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  const grouped = new Map(PROFESSIONAL_GAUNTLET_ROLE_IDS.map((id) => [id, []]));
  for (const track of tracks) grouped.get(normalizedRoleId(track)).push(track);

  return Object.freeze(Object.fromEntries(PROFESSIONAL_GAUNTLET_ROLE_IDS.map((roleId) => {
    const roleTracks = grouped.get(roleId);
    const eventCount = roleTracks.reduce((sum, track) => sum + (Array.isArray(track?.notes) ? track.notes.length : 0), 0);
    const pitches = roleTracks.flatMap((track) => (
      Array.isArray(track?.notes)
        ? track.notes.map((note) => finite(note?.pitch, null)).filter(Number.isFinite)
        : []
    ));
    return [roleId, Object.freeze({
      id: roleId,
      present: roleTracks.length > 0,
      sourceTrackIds: Object.freeze(roleTracks.map(normalizedTrackId)),
      eventCount,
      midiChannels: Object.freeze(
        roleTracks
          .map((track) => finite(track?.channel, finite(track?.midiChannel, null)))
          .filter(Number.isFinite),
      ),
      programs: Object.freeze(
        roleTracks
          .map((track) => finite(track?.program, null))
          .filter(Number.isFinite),
      ),
      renderedRange: Object.freeze({
        min: pitches.length ? Math.min(...pitches.map(canonicalMidiPitch)) : null,
        max: pitches.length ? Math.max(...pitches.map(canonicalMidiPitch)) : null,
      }),
    })];
  })));
}

function activeSection(sections, time) {
  return sections.find((section) => (
    time >= section.time && time < section.end
  )) ?? sections.at(-1) ?? null;
}

function activeHarmony(harmonyTimeline, time) {
  const direct = harmonyTimeline.find((entry) => time >= entry.time && time < entry.end);
  if (direct) return direct;
  let previous = null;
  for (const entry of harmonyTimeline) {
    if (entry.time > time) break;
    previous = entry;
  }
  return previous;
}

function keyPitchClass(song) {
  const explicit = finite(song?.meta?.keyPc, null);
  if (Number.isFinite(explicit)) return ((Math.round(explicit) % 12) + 12) % 12;
  const token = String(song?.meta?.key ?? "C").trim();
  const match = token.match(/^([A-Ga-g])([#b]?)/);
  if (!match) return 0;
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return ((natural + accidental) % 12 + 12) % 12;
}

function semanticPitchFor(song, note, renderedMidiPitch, roleId) {
  if (roleId === "drums") {
    return Object.freeze({
      type: "percussion",
      midiNote: renderedMidiPitch,
      native: cloneValue(note?.semanticPitch ?? null),
    });
  }
  const pitchClass = renderedMidiPitch % 12;
  const keyPc = keyPitchClass(song);
  const relativePitchClass = ((pitchClass - keyPc) % 12 + 12) % 12;
  const scaleIntervals = Array.isArray(song?.meta?.scaleIntervals)
    ? song.meta.scaleIntervals.map((value) => ((Math.round(finite(value, 0)) % 12) + 12) % 12)
    : [];
  const degreeIndex = scaleIntervals.indexOf(relativePitchClass);
  return Object.freeze({
    type: "pitched",
    noteName: PITCH_CLASS_NAMES[pitchClass],
    pitchClass,
    octave: Math.floor(renderedMidiPitch / 12) - 1,
    keyPitchClass: keyPc,
    relativePitchClass,
    scaleDegree: degreeIndex >= 0 ? degreeIndex + 1 : null,
    inScale: scaleIntervals.length ? degreeIndex >= 0 : null,
    native: cloneValue(note?.semanticPitch ?? null),
  });
}

function inferredArticulation(note) {
  if (note?.articulation != null && String(note.articulation).trim()) return String(note.articulation);
  const duration = Math.max(0, finite(note?.duration, 0));
  if (duration <= 0.25) return "staccato";
  if (duration <= 0.75) return "short";
  if (duration >= 2) return "sustain";
  if (duration >= 1.25) return "legato";
  return "normal";
}

function eventVelocity(note) {
  const raw = finite(note?.velocity, 96);
  const normalized = raw <= 1 ? raw * 127 : raw;
  return Math.round(clamp(normalized, 1, 127));
}

function nativeMotifId(note) {
  const value = note?.motifId ?? note?.motifID ?? note?.motif ?? note?.phraseId ?? null;
  return value == null || String(value).trim() === "" ? null : String(value);
}

function eventMotifId(note, roleId, section, time, beatsPerBar) {
  const native = nativeMotifId(note);
  if (native) return { id: native, source: "native" };
  const phraseSpan = beatsPerBar * 2;
  const phraseIndex = Math.max(0, Math.floor(time / Math.max(1, phraseSpan)));
  return {
    id: `derived:${roleId}:${section?.id ?? "song"}:${phraseIndex}`,
    source: "derived",
  };
}

function eventPhraseRole(note, roleId, section) {
  const native = note?.phraseRole ?? note?.phraseFunction ?? null;
  if (native != null && String(native).trim()) return { value: String(native), source: "native" };
  if (section?.role) return { value: String(section.role), source: "section" };
  if (roleId === "drums" || roleId === "bass") return { value: "groove-support", source: "role" };
  if (roleId === "chords" || roleId === "fx") return { value: "harmonic-support", source: "role" };
  return { value: "statement", source: "role" };
}

function normalizeMusicalEvents(song, sections, harmonyTimeline) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  const beatsPerBar = beatsPerBarOf(song);
  const events = [];

  for (const track of tracks) {
    const trackId = normalizedTrackId(track);
    const roleId = normalizedRoleId(track);
    for (const [noteIndex, note] of (track?.notes ?? []).entries()) {
      const time = round(finite(note?.start, finite(note?.time, 0)));
      const duration = round(Math.max(0, finite(note?.duration, 0)));
      const renderedMidiPitch = canonicalMidiPitch(note?.pitch ?? note?.note ?? note?.midi);
      const section = activeSection(sections, time);
      const harmony = activeHarmony(harmonyTimeline, time);
      const motif = eventMotifId(note, roleId, section, time, beatsPerBar);
      const phraseRole = eventPhraseRole(note, roleId, section);
      events.push(Object.freeze({
        id: `${trackId || roleId}:${noteIndex}:${time}`,
        trackId,
        roleId,
        sectionId: section?.id ?? null,
        time,
        duration,
        semanticPitch: semanticPitchFor(song, note, renderedMidiPitch, roleId),
        renderedMidiPitch,
        velocity: eventVelocity(note),
        chordContext: harmony == null ? null : Object.freeze({
          id: harmony.id,
          chord: harmony.chord,
          root: harmony.root,
          quality: harmony.quality,
          time: harmony.time,
          duration: harmony.duration,
        }),
        motifId: motif.id,
        motifSource: motif.source,
        phraseRole: phraseRole.value,
        phraseRoleSource: phraseRole.source,
        articulation: inferredArticulation(note),
      }));
    }
  }

  return Object.freeze(events.sort((left, right) => (
    left.time - right.time
      || left.roleId.localeCompare(right.roleId)
      || left.renderedMidiPitch - right.renderedMidiPitch
  )));
}

function normalizedIntent(song, intent = null) {
  const source = intent ?? song?.producerBrain?.blueprint?.intent ?? song?.songBlueprint?.intent ?? {};
  return Object.freeze({
    genre: song?.meta?.genre ?? song?.genre ?? null,
    key: song?.meta?.key ?? null,
    scale: song?.meta?.scale ?? null,
    bpm: finite(song?.meta?.bpm, null),
    bars: finite(song?.meta?.bars, null),
    energyArc: cloneValue(source?.energyArc ?? null),
    contrast: finite(source?.contrast, null),
    hookPressure: finite(source?.hookPressure, null),
    harmonicMotion: finite(source?.harmonicMotion, null),
    groovePressure: finite(source?.groovePressure, null),
    spaceReserve: finite(source?.spaceReserve, null),
    novelty: finite(source?.novelty, null),
  });
}

export function createProfessionalGenerationGauntletSong(song, {
  intent = null,
  blueprint = null,
} = {}) {
  if (!song || typeof song !== "object" || !Array.isArray(song.tracks)) {
    throw new TypeError("createProfessionalGenerationGauntletSong requires a generated song");
  }

  const sections = Object.freeze(normalizeSections(song));
  const harmonyTimeline = Object.freeze(normalizeHarmonyTimeline(song));
  const grooveTimeline = Object.freeze(normalizeGrooveTimeline(song));
  const instrumentRoles = roleAuthority(song);
  const musicalEvents = normalizeMusicalEvents(song, sections, harmonyTimeline);
  const resolvedBlueprint = blueprint
    ?? song?.songPlan
    ?? song?.songBlueprint
    ?? song?.producerBrain?.blueprint
    ?? null;

  return Object.freeze({
    version: 1,
    id: String(song?.id ?? song?.seed ?? "gauntlet-song"),
    sourceSongId: song?.id ?? null,
    sourceSeed: song?.seed ?? null,
    totalBeats: totalBeatsOf(song),
    intent: normalizedIntent(song, intent),
    blueprint: Object.freeze(cloneValue(resolvedBlueprint)),
    harmonyTimeline,
    grooveTimeline,
    sections,
    instrumentRoles,
    musicalEvents,
  });
}

function isSortedByTime(entries) {
  for (let index = 1; index < entries.length; index += 1) {
    if (finite(entries[index - 1]?.time, 0) > finite(entries[index]?.time, 0)) return false;
  }
  return true;
}

export function validateProfessionalGenerationGauntletSong(gauntletSong) {
  const issues = [];
  if (!gauntletSong || typeof gauntletSong !== "object") {
    return Object.freeze({ passed: false, issues: Object.freeze(["invalid-gauntlet-song"]), checks: Object.freeze({}) });
  }

  const roles = gauntletSong.instrumentRoles ?? {};
  const events = Array.isArray(gauntletSong.musicalEvents) ? gauntletSong.musicalEvents : [];
  const harmony = Array.isArray(gauntletSong.harmonyTimeline) ? gauntletSong.harmonyTimeline : [];
  const groove = Array.isArray(gauntletSong.grooveTimeline) ? gauntletSong.grooveTimeline : [];
  const sections = Array.isArray(gauntletSong.sections) ? gauntletSong.sections : [];

  const checks = {
    authorityComplete: Boolean(
      gauntletSong.intent
      && "blueprint" in gauntletSong
      && Array.isArray(gauntletSong.harmonyTimeline)
      && Array.isArray(gauntletSong.grooveTimeline)
      && Array.isArray(gauntletSong.sections)
      && gauntletSong.instrumentRoles
      && Array.isArray(gauntletSong.musicalEvents)
    ),
    roleAuthorityComplete: PROFESSIONAL_GAUNTLET_ROLE_IDS.every((roleId) => roles[roleId]?.id === roleId),
    timelinesOrdered: isSortedByTime(harmony) && isSortedByTime(groove) && isSortedByTime(sections) && isSortedByTime(events),
    eventTimingFinite: events.every((event) => (
      Number.isFinite(event.time) && event.time >= 0
      && Number.isFinite(event.duration) && event.duration >= 0
    )),
    renderedPitchRange: events.every((event) => (
      Number.isInteger(event.renderedMidiPitch)
      && event.renderedMidiPitch >= 0
      && event.renderedMidiPitch <= 127
    )),
    semanticRenderedPitchParity: events.every((event) => (
      event.roleId === "drums"
        ? event.semanticPitch?.midiNote === event.renderedMidiPitch
        : event.semanticPitch?.pitchClass === event.renderedMidiPitch % 12
    )),
    velocityRange: events.every((event) => (
      Number.isInteger(event.velocity) && event.velocity >= 1 && event.velocity <= 127
    )),
    motifTraceability: events.every((event) => typeof event.motifId === "string" && event.motifId.length > 0),
    phraseTraceability: events.every((event) => typeof event.phraseRole === "string" && event.phraseRole.length > 0),
    articulationTraceability: events.every((event) => typeof event.articulation === "string" && event.articulation.length > 0),
    harmonyContextCoverage: harmony.length === 0 || events
      .filter((event) => event.roleId !== "drums")
      .every((event) => event.chordContext != null),
  };

  for (const [check, passed] of Object.entries(checks)) {
    if (!passed) issues.push(check);
  }

  return Object.freeze({
    passed: issues.length === 0,
    issues: Object.freeze(issues),
    checks: Object.freeze(checks),
    counts: Object.freeze({
      sections: sections.length,
      harmonyEvents: harmony.length,
      grooveBars: groove.length,
      musicalEvents: events.length,
      activeRoles: PROFESSIONAL_GAUNTLET_ROLE_IDS.filter((roleId) => roles[roleId]?.present).length,
    }),
  });
}
