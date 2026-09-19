function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function desiredAttacksPerBar({ density, intensity }) {
  const normalizedDensity = clamp(density, 0, 1);
  const normalizedIntensity = clamp(intensity, 0, 1.25);
  let attacks = 1.35 + normalizedDensity * 0.45;
  if (normalizedIntensity < 0.7) attacks -= 0.25;
  if (normalizedIntensity >= 0.9) attacks += 0.2;
  if (normalizedIntensity >= 1.05) attacks += 0.2;
  return clamp(attacks, 1, 2.25);
}

function nearestUnusedEvent(events, target, selected) {
  return events
    .map((event, index) => ({
      index,
      distance: Math.abs(finite(event?.offset, index) - target),
    }))
    .filter(({ index }) => !selected.has(index))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)[0]?.index ?? null;
}

/**
 * Pick deterministic melody events that must survive probabilistic thinning.
 *
 * The engine already uses density, section energy and groove probability to
 * create variation. This helper adds a local continuity floor so a healthy
 * motif cannot collapse to only its first/middle/last notes in ordinary song
 * sections. Low-energy sections still retain more breathing room.
 */
export function phraseContinuityAnchorIndexes(motif, {
  beatsPerBar = 4,
  density = 0.64,
  intensity = 0.8,
  counterpoint = false,
} = {}) {
  const events = Array.isArray(motif?.events) ? motif.events : [];
  if (counterpoint || !events.length) return [];
  if (events.length <= 3) return events.map((_, index) => index);

  const safeBeatsPerBar = Math.max(1, finite(beatsPerBar, 4));
  const lengthBeats = Math.max(
    safeBeatsPerBar,
    finite(motif?.lengthBeats, safeBeatsPerBar),
  );
  const bars = Math.max(1, lengthBeats / safeBeatsPerBar);
  const desired = Math.min(
    events.length,
    Math.max(3, Math.ceil(
      bars * desiredAttacksPerBar({ density, intensity }),
    )),
  );

  const firstIndex = 0;
  const lastIndex = events.length - 1;
  const firstOffset = finite(events[firstIndex]?.offset, 0);
  const lastOffset = Math.max(
    firstOffset,
    finite(events[lastIndex]?.offset, lengthBeats),
  );
  const span = Math.max(0, lastOffset - firstOffset);
  const selected = new Set([firstIndex, lastIndex]);

  for (let slot = 1; slot < desired - 1; slot += 1) {
    const target = firstOffset + span * (slot / (desired - 1));
    const index = nearestUnusedEvent(events, target, selected);
    if (index != null) selected.add(index);
  }

  // Degenerate or duplicate offsets can make target selection collide. Fill
  // deterministically by event order so the requested continuity floor holds.
  for (let index = 0; selected.size < desired && index < events.length; index += 1) {
    selected.add(index);
  }

  return [...selected].sort((left, right) => left - right);
}
