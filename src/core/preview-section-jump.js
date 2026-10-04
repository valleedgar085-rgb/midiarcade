function finiteBeat(value) {
  const beat = Number(value);
  return Number.isFinite(beat) ? beat : null;
}

export function queuedSectionJumpDue(currentBeat, queuedSection) {
  const beat = finiteBeat(currentBeat);
  const triggerBeat = finiteBeat(queuedSection?.triggerBeat);
  return beat != null && triggerBeat != null && beat >= triggerBeat;
}
