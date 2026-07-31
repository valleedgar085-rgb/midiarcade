import { finite } from "../utils.js";

export function createPlaybackView({
  sections = [],
  bars = 0,
  bpm = 120,
  beatsPerBar = 4,
} = {}) {
  const safeBpm = Math.max(1, finite(bpm, 120));
  const safeBeatsPerBar = Math.max(0.25, finite(beatsPerBar, 4));
  const normalizedSections = Array.isArray(sections)
    ? sections.map((section, index) => Object.freeze({
      id: String(section?.id ?? `section-${index}`),
      name: String(section?.name ?? `Part ${index + 1}`),
      start: Math.max(0, finite(section?.start, 0)),
      bars: Math.max(0, finite(section?.bars, 0)),
      energy: finite(section?.energy, 0.5),
    }))
    : [];
  const safeBars = Math.max(
    0,
    finite(bars, normalizedSections.at(-1)?.start + normalizedSections.at(-1)?.bars || 0),
  );

  function sectionAtBeat(beat) {
    const bar = Math.max(0, finite(beat, 0)) / safeBeatsPerBar;
    return normalizedSections.find((section) => (
      bar >= section.start - 1e-7
      && bar < section.start + section.bars - 1e-7
    )) ?? normalizedSections.at(-1) ?? null;
  }

  function sectionAtSeconds(seconds) {
    return sectionAtBeat(Math.max(0, finite(seconds, 0)) * safeBpm / 60);
  }

  return Object.freeze({
    sections: Object.freeze(normalizedSections),
    bars: safeBars,
    bpm: safeBpm,
    beatsPerBar: safeBeatsPerBar,
    sectionAtBeat,
    sectionAtSeconds,
  });
}

export function shouldRefreshPlaybackDetails(lastRefreshSeconds, currentSeconds, refreshMs = 250) {
  const last = finite(lastRefreshSeconds, -Infinity);
  const current = finite(currentSeconds, 0);
  const interval = Math.max(0, finite(refreshMs, 250)) / 1000;
  return current - last >= interval;
}
