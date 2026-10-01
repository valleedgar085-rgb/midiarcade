// Original musical rules informed by the user's TRENCHES, GRAND and RIVALS
// references. No sampled audio or transcribed melodies are included.
export const TRAP_REFERENCE_PACK_ID = "hard-trap-pocket-v1";

export function usesHardTrapReferences(config = {}) {
  return config.trapReferencePack === TRAP_REFERENCE_PACK_ID
    && config.genre === "trap"
    && !config.secondaryGenre
    && config.professionalUpgrade === true;
}

export function applyHardTrapStyle(style, config) {
  return usesHardTrapReferences(config)
    ? { ...style, drumGroove: "halfTime", bassGroove: "syncopated", chordMotion: "sustained" }
    : style;
}

export function hardTrapGrooveGrammar(base, cellIndex = 0) {
  const cells = [[0, 3, 6, 10, 14], [0, 6, 10, 13], [0, 3, 7, 10, 14]];
  return {
    ...base,
    characterId: "hard-trap-kick-808",
    base: { ...base.base, kick: cells[cellIndex % cells.length], percussion: [7, 15] },
    probability: { ...base.probability, kick: 0.96, percussion: 0.35 },
    density: { ...base.density, hat: 1.04, percussion: 0.55 },
    transforms: [
      { lane: "hat", type: "burstEvery", every: 4, count: 3, spacingSteps: 0.6667, chance: 0.65 },
      { lane: "hat", type: "tripletTurn", every: 8, chance: 0.6 },
    ],
    relationships: {
      ...base.relationships,
      bass: { source: "kick", mode: "808-root-and-short-reply", lock: 1, answerDelayBeats: 0.5, syncopation: 0.24 },
      lead: { source: "snare", mode: "repeating-loop-around-backbeat", lock: 1, offsetBeats: -0.5, syncopation: 0.36 },
    },
  };
}

export function shapeHardTrapMotif(motif, beatsPerBar, rng) {
  if (!motif?.events?.length) return motif;
  const cells = [[0, 0.75, 2.5], [0, 1.5, 3], [0.5, 1.5, 2.75]];
  const cell = rng.pick(cells);
  const scale = beatsPerBar / 4;
  const bars = motif.lengthBeats >= beatsPerBar * 2 - 0.01 ? 2 : 1;
  const home = motif.events[0].degree;
  const direction = rng.pick([-1, 1]);
  const contour = [home, home + direction, home + direction * 2];
  const gesture = cell.map((offset, index) => ({
    offset: offset * scale,
    duration: Math.min(index === 2 ? 0.45 : 1.1, (cell[index + 1] ?? 3.6) - offset - 0.125) * scale,
    degree: contour[index],
    accent: index === 0 ? 1 : index === 2 ? 0.86 : 0.72,
  }));
  return {
    ...motif,
    referencePack: TRAP_REFERENCE_PACK_ID,
    lengthBeats: bars * beatsPerBar,
    phraseShape: "sparseEcho",
    events: Array.from({ length: bars }, (_, bar) => gesture.map((event, index) => ({
      ...event,
      offset: event.offset + bar * beatsPerBar,
      degree: bar === 1 && index === 2 ? home : event.degree,
    }))).flat(),
  };
}
