import { cloneValue } from "./clone-value.js";
import { normalizeGenreId } from "./genre-contract.js";

export const TRANSITION_FX_VERSION = 1;
export const MAX_TRANSITION_FX_BOUNDARIES = 4;

const PAYOFF_SECTIONS = new Set(["chorus", "drop", "theme"]);
const RISING_TYPES = new Set(["lift", "build", "launch", "push"]);
const PROFILE_BY_GENRE = Object.freeze({
  techno: Object.freeze({
    id: "techno-motion",
    tracks: Object.freeze(["chords", "counterpoint", "pad"]),
    pickupScale: 1.35,
    brightnessDip: 24,
    brightnessPeak: 46,
    brightnessSettle: 24,
    reverbPeak: 24,
    reverbSettle: 8,
    throwAmount: 34,
  }),
  pop: Object.freeze({
    id: "pop-lift",
    tracks: Object.freeze(["chords", "counterpoint", "pad"]),
    pickupScale: 1,
    brightnessDip: 12,
    brightnessPeak: 28,
    brightnessSettle: 14,
    reverbPeak: 18,
    reverbSettle: 7,
    throwAmount: 24,
  }),
  popRadio: Object.freeze({
    id: "pop-lift",
    tracks: Object.freeze(["chords", "counterpoint", "pad"]),
    pickupScale: 1,
    brightnessDip: 12,
    brightnessPeak: 30,
    brightnessSettle: 16,
    reverbPeak: 20,
    reverbSettle: 8,
    throwAmount: 26,
  }),
  rock: Object.freeze({
    id: "live-rock-lift",
    tracks: Object.freeze(["chords", "counterpoint"]),
    pickupScale: 0.85,
    brightnessDip: 6,
    brightnessPeak: 14,
    brightnessSettle: 7,
    reverbPeak: 10,
    reverbSettle: 4,
    throwAmount: 14,
  }),
  jazz: Object.freeze({
    id: "jazz-room-motion",
    tracks: Object.freeze(["chords", "counterpoint"]),
    pickupScale: 0.75,
    brightnessDip: 3,
    brightnessPeak: 7,
    brightnessSettle: 3,
    reverbPeak: 8,
    reverbSettle: 3,
    throwAmount: 11,
  }),
});

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function trackId(track) {
  return String(track?.id ?? track?.role ?? track?.name ?? "");
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure
    : Array.isArray(song?.sections) ? song.sections
      : [];
}

function sectionById(song, id) {
  return sectionsOf(song).find((section) => String(section?.id) === String(id)) ?? null;
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? "").toLowerCase();
}

function totalBeats(song) {
  const explicit = finite(song?.meta?.totalBeats, 0);
  if (explicit > 0) return explicit;
  return sectionsOf(song).reduce((max, section) => Math.max(max, finite(section?.endBeat, 0)), 0);
}

function boundaryFor(song, transition) {
  const from = sectionById(song, transition?.fromSectionId);
  const direct = finite(from?.endBeat, NaN);
  if (Number.isFinite(direct)) return direct;
  const to = sectionById(song, transition?.toSectionId);
  const fallback = finite(to?.startBeat, NaN);
  return Number.isFinite(fallback) ? fallback : null;
}

function baseControllerValue(track, controller) {
  if (controller === 74) return 64;
  if (controller === 91) return clamp(Math.round(finite(track?.settings?.reverb ?? track?.controls?.reverb, 0.25) * 127), 0, 127);
  return 64;
}

function ownFxEvent(event) {
  return Number(event?.transitionFxVersion) === TRANSITION_FX_VERSION;
}

function sameControllerBeat(event, controller, beat) {
  return String(event?.type).toLowerCase() === "cc"
    && Number(event?.controller) === controller
    && Math.abs(finite(event?.beat, -9999) - beat) <= 1e-4;
}

function addAutomationPoint(events, {
  controller,
  beat,
  value,
  transitionId,
  role,
  total,
}) {
  const safeBeat = round(clamp(beat, 0, Math.max(0, total)));
  if (events.some((event) => sameControllerBeat(event, controller, safeBeat) && !ownFxEvent(event))) return false;
  const prior = events.findIndex((event) => sameControllerBeat(event, controller, safeBeat) && ownFxEvent(event));
  const point = {
    type: "cc",
    controller,
    beat: safeBeat,
    value: Math.round(clamp(value, 0, 127)),
    transitionFxVersion: TRANSITION_FX_VERSION,
    transitionFxId: transitionId,
    transitionFxRole: role,
  };
  if (prior >= 0) events[prior] = point;
  else events.push(point);
  return true;
}

function transitionPriority(song, transition) {
  const destination = sectionById(song, transition?.toSectionId);
  if (PAYOFF_SECTIONS.has(sectionName(destination))) return 3;
  if (String(transition?.type) === "drop-out") return 2;
  if (RISING_TYPES.has(String(transition?.type))) return 1;
  return 0;
}

function selectTransitions(song) {
  return (Array.isArray(song?.arrangementTransitions) ? song.arrangementTransitions : [])
    .map((transition, index) => ({ transition, index, priority: transitionPriority(song, transition) }))
    .filter(({ priority }) => priority > 0)
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .slice(0, MAX_TRANSITION_FX_BOUNDARIES)
    .sort((left, right) => left.index - right.index)
    .map(({ transition }) => transition);
}

function applySweep(events, track, transition, boundary, total, profile, destination) {
  const id = `${transition.fromSectionId}->${transition.toSectionId}`;
  const pickup = clamp(finite(transition?.pickupBeats, 1) * profile.pickupScale, 0.5, 2);
  const start = Math.max(0, boundary - pickup);
  const peak = Math.max(start, boundary - 0.0625);
  const settle = Math.min(total, boundary + 0.5);
  const brightness = baseControllerValue(track, 74);
  const reverb = baseControllerValue(track, 91);
  const payoff = PAYOFF_SECTIONS.has(sectionName(destination));
  const type = String(transition?.type ?? "");
  let added = 0;

  if (type === "drop-out") {
    added += Number(addAutomationPoint(events, { controller: 74, beat: start, value: brightness, transitionId: id, role: "breath-start", total }));
    added += Number(addAutomationPoint(events, { controller: 74, beat: peak, value: brightness - profile.brightnessDip, transitionId: id, role: "breath-close", total }));
    added += Number(addAutomationPoint(events, { controller: 74, beat: boundary, value: brightness, transitionId: id, role: "breath-reset", total }));
    added += Number(addAutomationPoint(events, { controller: 91, beat: start, value: reverb, transitionId: id, role: "throw-start", total }));
    added += Number(addAutomationPoint(events, { controller: 91, beat: peak, value: reverb + profile.throwAmount, transitionId: id, role: "throw-peak", total }));
    added += Number(addAutomationPoint(events, { controller: 91, beat: boundary, value: reverb + profile.reverbSettle, transitionId: id, role: "throw-tail", total }));
    return added;
  }

  const peakLift = payoff ? profile.brightnessPeak : Math.round(profile.brightnessPeak * 0.7);
  const reverbLift = payoff ? profile.reverbPeak : Math.round(profile.reverbPeak * 0.7);
  added += Number(addAutomationPoint(events, { controller: 74, beat: start, value: brightness - profile.brightnessDip, transitionId: id, role: "riser-dark", total }));
  added += Number(addAutomationPoint(events, { controller: 74, beat: peak, value: brightness + peakLift, transitionId: id, role: "riser-open", total }));
  added += Number(addAutomationPoint(events, { controller: 74, beat: settle, value: brightness + profile.brightnessSettle, transitionId: id, role: "arrival-open", total }));
  added += Number(addAutomationPoint(events, { controller: 91, beat: start, value: reverb, transitionId: id, role: "bloom-start", total }));
  added += Number(addAutomationPoint(events, { controller: 91, beat: peak, value: reverb + reverbLift, transitionId: id, role: "bloom-peak", total }));
  added += Number(addAutomationPoint(events, { controller: 91, beat: settle, value: reverb + profile.reverbSettle, transitionId: id, role: "bloom-settle", total }));
  return added;
}

export function createTransitionFxCandidate(sourceSong, config = {}) {
  const genre = normalizeGenreId(config?.genre ?? sourceSong?.meta?.genre ?? sourceSong?.genre ?? "");
  const profile = PROFILE_BY_GENRE[genre] ?? null;
  if (!profile || config?.isFusion === true || Boolean(config?.secondaryGenre)) {
    return Object.freeze({
      changed: false,
      song: sourceSong,
      diagnostics: Object.freeze({ reason: "genre-not-eligible", genre, profile: null, automationPoints: 0, transitionsShaped: 0 }),
    });
  }
  const selected = selectTransitions(sourceSong);
  const total = totalBeats(sourceSong);
  if (!selected.length || total <= 0) {
    return Object.freeze({
      changed: false,
      song: sourceSong,
      diagnostics: Object.freeze({ reason: "no-major-transition", genre, profile: profile.id, automationPoints: 0, transitionsShaped: 0 }),
    });
  }

  const song = cloneValue(sourceSong);
  const targetIds = new Set(profile.tracks);
  let automationPoints = 0;
  let tracksShaped = 0;
  for (const track of song.tracks ?? []) {
    if (!targetIds.has(trackId(track))) continue;
    const events = (Array.isArray(track.automation) ? track.automation : []).filter((event) => !ownFxEvent(event));
    let trackPoints = 0;
    for (const transition of selected) {
      const boundary = boundaryFor(song, transition);
      if (!Number.isFinite(boundary) || boundary <= 0 || boundary >= total + 1e-6) continue;
      const destination = sectionById(song, transition.toSectionId);
      trackPoints += applySweep(events, track, transition, boundary, total, profile, destination);
    }
    events.sort((left, right) => finite(left?.beat) - finite(right?.beat)
      || finite(left?.controller) - finite(right?.controller)
      || finite(left?.value) - finite(right?.value));
    track.automation = events;
    if (trackPoints > 0) tracksShaped += 1;
    automationPoints += trackPoints;
  }

  if (!automationPoints) {
    return Object.freeze({
      changed: false,
      song: sourceSong,
      diagnostics: Object.freeze({ reason: "automation-conflict", genre, profile: profile.id, automationPoints: 0, transitionsShaped: 0 }),
    });
  }

  const diagnostics = Object.freeze({
    version: TRANSITION_FX_VERSION,
    reason: "transition-fx-candidate",
    genre,
    profile: profile.id,
    automationPoints,
    transitionsShaped: selected.length,
    tracksShaped,
    controllers: Object.freeze([74, 91]),
  });
  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    transitionFx: diagnostics,
  };
  return Object.freeze({ changed: true, song, diagnostics });
}

export function applyTransitionFxRefinement(
  sourceSong,
  config = {},
  evaluateCandidate,
  evaluateReleaseGate,
) {
  if (config?.transitionFxRefinement !== true) {
    return {
      song: sourceSong,
      diagnostics: Object.freeze({ attempted: false, accepted: false, changed: false, reason: "disabled", automationPoints: 0 }),
    };
  }
  const candidate = createTransitionFxCandidate(sourceSong, config);
  if (!candidate.changed) {
    return {
      song: sourceSong,
      diagnostics: Object.freeze({ attempted: true, accepted: false, changed: false, ...candidate.diagnostics }),
    };
  }
  const evaluation = typeof evaluateCandidate === "function" ? evaluateCandidate(candidate.song) : null;
  const release = typeof evaluateReleaseGate === "function"
    ? evaluateReleaseGate(candidate.song, evaluation)
    : { passed: true };
  const scaleSafe = evaluation == null || finite(evaluation?.diagnostics?.scaleFit, 1) >= 0.999999;
  const accepted = Boolean(release?.passed !== false && scaleSafe);
  const diagnostics = Object.freeze({
    ...candidate.diagnostics,
    attempted: true,
    accepted,
    changed: accepted,
    reason: !scaleSafe ? "scale-safety" : release?.passed === false ? "release-gate" : "fx-safe",
  });
  if (!accepted) return { song: sourceSong, diagnostics };
  candidate.song.outputQualityEvolution = {
    ...(candidate.song.outputQualityEvolution ?? {}),
    transitionFx: diagnostics,
  };
  return { song: candidate.song, diagnostics };
}
