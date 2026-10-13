// Presentation-only guidance. Never read or mutate musical song state here.
export function createDirectionStatus({ hasSong = false, sameGenre = false, staged = false } = {}) {
  return {
    label: staged ? "CHANGES STAGED" : hasSong ? "DIRECTION READY" : "READY TO GENERATE",
    state: staged ? "staged" : "ready",
    hint: !hasSong
      ? "Choose your direction, then generate a song."
      : sameGenre
        ? "Manual Tempo changes this playing song; other controls shape the next generation."
        : "You are staging a new genre. The current song remains unchanged until you generate.",
  };
}
