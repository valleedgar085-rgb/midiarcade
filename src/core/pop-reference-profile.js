// Broad arrangement traits from the user's SOS and Sunburn references.
// These are original rhythm cells, not transcriptions or samples.
export const POP_REFERENCE_PACK_ID = "groovy-funk-pop-v1";

export function usesGroovyPopReferences(config = {}) {
  return config.popReferencePack === POP_REFERENCE_PACK_ID
    && config.genre === "pop"
    && !config.secondaryGenre
    && config.professionalUpgrade === true;
}

export function popReferencePocketPosition(bar, section) {
  const local = Math.max(0, bar - section.startBar);
  return { cell: local % 2, turnaround: local % 4 === 3 };
}

export function applyGroovyPopStyle(style, config) {
  return usesGroovyPopReferences(config)
    ? { ...style, drumGroove: "backbeat", bassGroove: "syncopated", chordMotion: "offbeat" }
    : style;
}

export function shapeGroovyPopMotif(motif, beatsPerBar, rng) {
  if (!motif?.events?.length) return motif;
  const cells = [
    [0, 0.75, 1.5, 2.5],
    [0.5, 1, 1.75, 2.5],
    [0, 1, 1.75, 2.75],
    [0, 0.5, 1.5, 2.5],
  ];
  const cell = rng.pick(cells);
  const scale = beatsPerBar / 4;
  const bars = motif.lengthBeats >= beatsPerBar * 2 - 0.01 ? 2 : 1;
  const source = motif.events;
  const gesture = cell.map((offset, index) => {
    const event = source[Math.min(source.length - 1, Math.floor(index * source.length / cell.length))];
    const next = cell[index + 1] ?? 3.5;
    return {
      ...event,
      offset: offset * scale,
      duration: Math.min(index === cell.length - 1 ? 0.65 : 0.5, next - offset - 0.125) * scale,
      accent: index === 0 ? 1 : index === cell.length - 1 ? 0.88 : 0.76,
    };
  });
  return {
    ...motif,
    referencePack: POP_REFERENCE_PACK_ID,
    lengthBeats: bars * beatsPerBar,
    phraseShape: "questionAnswer",
    events: Array.from({ length: bars }, (_, bar) => gesture.map((event, index) => ({
      ...event,
      offset: event.offset + bar * beatsPerBar,
      // Keep the opening gesture recognizable; the answer lands at home.
      degree: bar === 1 && index === gesture.length - 1 ? gesture[0].degree : event.degree,
    }))).flat(),
  };
}
