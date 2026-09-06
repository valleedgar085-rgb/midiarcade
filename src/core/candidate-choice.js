const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

/** Quantized, transposition-invariant phrase identity, not sound-kit identity. */
export function musicalIdentity(song = {}) {
  const result = {};
  for (const id of ["melody", "bass", "drums"]) {
    const notes = [...(song.tracks?.find((track) => track.id === id)?.notes ?? [])]
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    const phrases = [];
    // Sample the full arrangement, not just the opening twelve notes.
    const stride = Math.max(4, Math.ceil(notes.length / 24 / 4) * 4);
    for (let index = 0; index + 3 < notes.length; index += stride) {
      const group = notes.slice(index, index + 4);
      const first = group[0];
      phrases.push(group.map((note) => [
        id === "drums" ? note.pitch : note.pitch - first.pitch,
        Math.round((note.start - first.start) * 4),
        Math.round(note.duration * 4),
      ].join(":")).join("/"));
    }
    result[id] = phrases;
  }
  return result;
}

function phraseOverlap(left = [], right = []) {
  if (!left.length || !right.length) return null;
  const a = new Set(left);
  const b = new Set(right);
  return 2 * [...a].filter((phrase) => b.has(phrase)).length / (a.size + b.size);
}

export function musicalIdentitySimilarity(left, right) {
  if (!left || !right) return null;
  let sum = 0;
  let weight = 0;
  for (const [id, importance] of [["melody", 0.5], ["bass", 0.3], ["drums", 0.2]]) {
    const overlap = phraseOverlap(left[id], right[id]);
    if (overlap === null) continue;
    sum += overlap * importance;
    weight += importance;
  }
  return weight ? sum / weight : null;
}

/** Safety/release gates are applied before this score, never traded for novelty. */
export function scoreCandidateChoice(evaluation, balance, novelty, generation) {
  const replayPenalty = generation === "new" && novelty?.backToBackRepeat ? 200 : 0;
  const quality = evaluation.score;
  if (!novelty?.compared) {
    return quality * 0.8 + balance.balanceScore * 0.12 + balance.creativeFloor * 0.08 - replayPenalty;
  }
  if (generation === "similar") {
    return quality * 0.68 + balance.balanceScore * 0.12 + balance.creativeFloor * 0.08 + novelty.score * 0.12;
  }
  // Reward a new hook/groove, not a new seed or timbre over the same phrase.
  const phraseFreshness = novelty.musicalSimilarity == null ? novelty.score
    : (1 - clamp(novelty.musicalSimilarity, 0, 1)) * 100;
  const freshness = novelty.score * 0.65 + phraseFreshness * 0.35;
  const harmony = Math.min(evaluation.subscores?.harmonic ?? quality, evaluation.subscores?.phraseResolution ?? quality);
  return quality * 0.62 + balance.balanceScore * 0.12 + balance.creativeFloor * 0.08
    + freshness * 0.14 + harmony * 0.04 - replayPenalty;
}
