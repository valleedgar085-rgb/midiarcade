const TRACK_LANE = Object.freeze({
  drums: "anchors",
  bass: "bassPulses",
  chords: "chordPulses",
  melody: "leadPulses",
  counterpoint: "counterPulses",
  pad: "chordPulses",
});

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

export function grooveLaneForTrack(trackId) {
  return TRACK_LANE[String(trackId ?? "")] ?? "anchors";
}

export function grooveBarPlan(conductor, bar) {
  const bars = Array.isArray(conductor?.bars) ? conductor.bars : [];
  const index = Math.max(0, Math.floor(finite(bar, 0)));
  const indexed = bars[index];
  if (indexed && Math.floor(finite(indexed?.bar, index)) === index) return indexed;
  return bars.find((entry) => Math.floor(finite(entry?.bar, -1)) === index) ?? null;
}

export function absoluteGroovePulses(
  conductor,
  lane,
  startBeat,
  endBeat,
  beatsPerBar = 4,
) {
  const barBeats = Math.max(1, finite(beatsPerBar, 4));
  const start = Math.max(0, finite(startBeat, 0));
  const end = Math.max(start, finite(endBeat, start));
  if (end <= start + 1e-9) return [];
  const firstBar = Math.floor(start / barBeats);
  const lastBar = Math.floor(Math.max(start, end - 1e-7) / barBeats);
  const pulses = [];
  for (let bar = firstBar; bar <= lastBar; bar += 1) {
    const plan = grooveBarPlan(conductor, bar);
    const barStart = bar * barBeats;
    for (const offset of plan?.[lane] ?? []) {
      const beat = round(barStart + finite(offset));
      if (beat >= start - 1e-7 && beat < end - 1e-7) pulses.push(beat);
    }
  }
  return [...new Set(pulses)].sort((left, right) => left - right);
}

export function trackGroovePulses(
  conductor,
  trackId,
  startBeat,
  endBeat,
  beatsPerBar = 4,
) {
  return absoluteGroovePulses(
    conductor,
    grooveLaneForTrack(trackId),
    startBeat,
    endBeat,
    beatsPerBar,
  );
}

export function nearestGroovePulse(
  conductor,
  lane,
  beat,
  beatsPerBar = 4,
  maximumDistance = Infinity,
) {
  const target = finite(beat, 0);
  const barBeats = Math.max(1, finite(beatsPerBar, 4));
  const bar = Math.max(0, Math.floor(target / barBeats));
  const plan = grooveBarPlan(conductor, bar);
  const barStart = bar * barBeats;
  const candidates = (plan?.[lane] ?? [])
    .map((offset) => round(barStart + finite(offset)))
    .sort((left, right) => Math.abs(left - target) - Math.abs(right - target) || left - right);
  const nearest = candidates[0];
  if (!Number.isFinite(nearest)) {
    return Object.freeze({ beat: target, snapped: false, lane, distance: null });
  }
  const distance = Math.abs(nearest - target);
  if (distance > finite(maximumDistance, Infinity) + 1e-9) {
    return Object.freeze({ beat: target, snapped: false, lane, distance: round(distance) });
  }
  return Object.freeze({
    beat: nearest,
    snapped: distance > 0.001,
    lane,
    distance: round(distance),
  });
}
