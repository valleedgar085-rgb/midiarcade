import { cloneValue } from "./clone-value.js";
export const ARRANGEMENT_PERFORMANCE_VERSION = 2;

const SAFE_TRACKS = new Set(["drums", "chords", "counterpoint", "pad"]);
const PAYOFF_NAMES = new Set(["chorus", "drop", "theme"]);

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

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function sectionById(song, id) {
  return sectionsOf(song).find((section) => String(section?.id) === String(id)) ?? null;
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase();
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function noteDuration(note) {
  return finite(note?.duration ?? note?.length, 0.25);
}

function notePitch(note) {
  return finite(note?.pitch ?? note?.note ?? note?.midi, 60);
}

function noteVelocity(note) {
  const value = finite(note?.velocity ?? note?.vel, 90);
  return value <= 1 ? value * 127 : value;
}

function setNoteVelocity(note, value) {
  const key = Object.prototype.hasOwnProperty.call(note, "vel") ? "vel" : "velocity";
  const bounded = Math.round(clamp(value, 1, 127));
  note[key] = finite(note?.[key], 90) <= 1 ? round(bounded / 127) : bounded;
}

function transitionId(transition) {
  return `${transition.fromSectionId}->${transition.toSectionId}`;
}

function transitionBoundary(song, transition) {
  const from = sectionById(song, transition.fromSectionId);
  return finite(from?.endBeat, NaN);
}

function safeTrackEntries(song) {
  return (song?.tracks ?? [])
    .filter((track) => SAFE_TRACKS.has(String(track?.id ?? "")))
    .map((track) => ({ track, trackId: String(track.id) }));
}

function clearStaleHandoffMetadata(song, validIds) {
  let cleared = 0;
  for (const { track } of safeTrackEntries(song)) {
    for (const note of track.notes ?? []) {
      const handoffId = String(note?.transitionHandoffId ?? "");
      if (!handoffId || validIds.has(handoffId)) continue;
      delete note.transitionHandoffId;
      delete note.transitionHandoffRole;
      delete note.transitionFeature;
      cleared += 1;
    }
  }
  return cleared;
}

function markPickup(note, transition, velocityDelta) {
  const before = noteVelocity(note);
  setNoteVelocity(note, before + velocityDelta);
  note.transitionFeature = transition.type;
  note.transitionHandoffId = transitionId(transition);
  note.transitionHandoffRole = `${transition.type}-pickup`;
  return Math.abs(noteVelocity(note) - before) > 1e-6;
}

function markArrival(note, transition, velocityDelta) {
  const before = noteVelocity(note);
  setNoteVelocity(note, before + velocityDelta);
  note.transitionFeature = transition.type;
  note.transitionHandoffId = transitionId(transition);
  note.transitionHandoffRole = `${transition.type}-arrival`;
  return Math.abs(noteVelocity(note) - before) > 1e-6;
}

function wantsLocalizedVacuum(song, transition, options = {}) {
  if (options.spaceStrategy !== "vacuum-before-payoff") return false;
  if (song?.meta?.isFusion === true) return false;
  const bars = finite(song?.meta?.bars ?? song?.meta?.totalBars, 0);
  if (bars > 0 && bars < 12) return false;
  const destination = sectionById(song, transition.toSectionId);
  return PAYOFF_NAMES.has(sectionName(destination));
}

function applyLocalizedVacuum(song, transition, boundary, pickupBeats) {
  const id = transitionId(transition);
  let changedNotes = 0;
  let vacuumNotes = 0;
  for (const { track, trackId } of safeTrackEntries(song)) {
    if (trackId === "drums") continue;
    const candidates = (track.notes ?? [])
      .filter((note) => {
        const start = noteStart(note);
        return start >= boundary - Math.min(1, pickupBeats) - 1e-6 && start < boundary - 1e-6;
      })
      .sort((left, right) => noteStart(right) - noteStart(left) || notePitch(left) - notePitch(right))
      .slice(0, 1);
    for (const note of candidates) {
      const before = noteVelocity(note);
      setNoteVelocity(note, before - 10);
      note.arrangementPerformanceRole = "pre-payoff-vacuum";
      note.arrangementPerformanceTransitionId = id;
      vacuumNotes += 1;
      if (Math.abs(noteVelocity(note) - before) > 1e-6) changedNotes += 1;
    }
  }
  return { changedNotes, vacuumNotes };
}

function shapeTransition(song, transition, profile, options = {}) {
  const boundary = transitionBoundary(song, transition);
  if (!Number.isFinite(boundary)) return { changedNotes: 0, pickups: 0, arrivals: 0, payoff: false };

  const pickupBeats = clamp(transition.pickupBeats, 0.25, 1.5);
  const destination = sectionById(song, transition.toSectionId);
  const payoff = PAYOFF_NAMES.has(sectionName(destination));
  const strength = clamp(transition.strength, 0.38, 0.92);
  const pickupBoost = Math.round((profile.pickupBoost + (payoff ? profile.payoffBonus : 0)) * strength);
  const arrivalBoost = Math.round((profile.arrivalBoost + (payoff ? profile.payoffBonus : 0)) * strength);
  let changedNotes = 0;
  let pickups = 0;
  let arrivals = 0;
  let vacuumNotes = 0;

  if (payoff && wantsLocalizedVacuum(song, transition, options)) {
    const vacuum = applyLocalizedVacuum(song, transition, boundary, pickupBeats);
    changedNotes += vacuum.changedNotes;
    vacuumNotes += vacuum.vacuumNotes;
  }

  for (const { track, trackId } of safeTrackEntries(song)) {
    const notes = track.notes ?? [];
    const pickupCandidates = notes
      .filter((note) => {
        const start = noteStart(note);
        return start >= boundary - pickupBeats - 1e-6 && start < boundary - 1e-6;
      })
      .sort((left, right) => noteStart(right) - noteStart(left) || notePitch(left) - notePitch(right))
      .slice(0, trackId === "drums" ? 2 : 1);

    for (const note of pickupCandidates) {
      const delta = transition.type === "drop-out"
        ? -Math.max(2, Math.round(profile.breathCut * strength))
        : pickupBoost;
      if (markPickup(note, transition, delta)) changedNotes += 1;
      pickups += 1;
    }

    const arrival = notes
      .filter((note) => Math.abs(noteStart(note) - boundary) <= 1e-6)
      .sort((left, right) => notePitch(left) - notePitch(right))[0];
    if (arrival) {
      if (markArrival(arrival, transition, arrivalBoost)) changedNotes += 1;
      arrivals += 1;
    }

    if (payoff && profile.openPayoff) {
      const firstBeatEnd = boundary + Math.min(1, finite(song?.meta?.beatsPerBar, 4) * 0.25);
      const bodyNotes = notes
        .filter((note) => noteStart(note) > boundary + 1e-6 && noteStart(note) < firstBeatEnd - 1e-6)
        .sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right))
        .slice(0, trackId === "drums" ? 2 : 1);
      for (const note of bodyNotes) {
        const before = noteVelocity(note);
        setNoteVelocity(note, before + Math.max(1, Math.round(profile.payoffBodyBoost * strength)));
        note.arrangementPerformanceRole = "payoff-open";
        note.arrangementPerformanceTransitionId = transitionId(transition);
        if (Math.abs(noteVelocity(note) - before) > 1e-6) changedNotes += 1;
      }
    }
  }

  return { changedNotes, pickups, arrivals, payoff, vacuumNotes };
}

const PROFILES = Object.freeze({
  balanced: Object.freeze({
    id: "balanced",
    pickupBoost: 4,
    arrivalBoost: 7,
    payoffBonus: 3,
    payoffBodyBoost: 3,
    breathCut: 5,
    openPayoff: true,
  }),
  impact: Object.freeze({
    id: "impact",
    pickupBoost: 5,
    arrivalBoost: 9,
    payoffBonus: 4,
    payoffBodyBoost: 4,
    breathCut: 6,
    openPayoff: true,
  }),
  restraint: Object.freeze({
    id: "restraint",
    pickupBoost: 3,
    arrivalBoost: 6,
    payoffBonus: 2,
    payoffBodyBoost: 2,
    breathCut: 7,
    openPayoff: false,
  }),
});

/**
 * Reconcile audible transition performance after an atomic section reorder.
 * This pass intentionally avoids melody and bass identity. It may only adjust
 * velocity and transition metadata on existing drums/support notes; pitch,
 * onset, duration, note count, section order and song length remain untouched.
 * The caller still owns critic/release acceptance of the resulting candidate.
 */
export function applyArrangementPerformance(sourceSong, { profile = "balanced", spaceStrategy = null } = {}) {
  const transitions = Array.isArray(sourceSong?.arrangementTransitions)
    ? sourceSong.arrangementTransitions
    : [];
  if (!transitions.length) {
    return Object.freeze({ changed: false, song: sourceSong, diagnostics: Object.freeze({ reason: "no-transitions" }) });
  }

  const selectedProfile = PROFILES[profile] ?? PROFILES.balanced;
  const song = cloneValue(sourceSong);
  const validIds = new Set(transitions.map(transitionId));
  const staleMarkersCleared = clearStaleHandoffMetadata(song, validIds);
  let changedNotes = 0;
  let pickups = 0;
  let arrivals = 0;
  let payoffTransitions = 0;
  let vacuumNotes = 0;

  for (const transition of song.arrangementTransitions) {
    const shaped = shapeTransition(song, transition, selectedProfile, { spaceStrategy });
    changedNotes += shaped.changedNotes;
    pickups += shaped.pickups;
    arrivals += shaped.arrivals;
    vacuumNotes += shaped.vacuumNotes ?? 0;
    if (shaped.payoff) payoffTransitions += 1;
  }

  const changed = staleMarkersCleared > 0 || changedNotes > 0;
  if (!changed) {
    return Object.freeze({
      changed: false,
      song: sourceSong,
      diagnostics: Object.freeze({ reason: "no-performance-opportunity", profile: selectedProfile.id }),
    });
  }

  const diagnostics = Object.freeze({
    version: ARRANGEMENT_PERFORMANCE_VERSION,
    profile: selectedProfile.id,
    changedNotes,
    staleMarkersCleared,
    pickups,
    arrivals,
    payoffTransitions,
    spaceStrategy,
    vacuumNotes,
    safeTracks: Object.freeze([...SAFE_TRACKS]),
  });
  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    arrangementPerformance: diagnostics,
  };
  return Object.freeze({ changed: true, song, diagnostics });
}
