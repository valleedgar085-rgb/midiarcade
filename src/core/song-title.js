function hash(text) {
  let value = 2166136261;
  for (const character of String(text ?? "")) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const GENRE_WORDS = Object.freeze({
  trap: [["Pressure", "Chrome", "Night", "Red", "Ghost", "Cold", "Black", "Static"], ["Season", "Signal", "Motion", "Theory", "Run", "Vision", "Hours", "District"]],
  drill: [["Cold", "Ghost", "Steel", "Night", "Red", "Shadow", "North", "Pressure"], ["Code", "Steps", "Line", "Run", "Signal", "Season", "Theory", "District"]],
  hipHop: [["Golden", "Corner", "Sunday", "Blue", "Late", "Pocket", "Sidewalk", "Warm"], ["Hours", "Radio", "Story", "Motion", "Frames", "Weather", "Tape", "Season"]],
  rap: [["Open", "City", "Late", "True", "Side", "North", "Quiet", "Heavy"], ["Statement", "Lines", "Chapter", "Motion", "Proof", "Hours", "Story", "Run"]],
  pop: [["Golden", "Electric", "Summer", "Bright", "After", "Open", "Satellite", "Neon"], ["Hours", "Heart", "Skyline", "Motion", "Cinema", "Daylight", "Signal", "Dream"]],
  synthwave: [["Neon", "Chrome", "Midnight", "Laser", "Electric", "Night", "Violet", "Satellite"], ["Tide", "Drive", "Mirage", "Signal", "Horizon", "Arcade", "Theory", "Cinema"]],
  rnbSoul: [["Velvet", "Blue", "Slow", "Soft", "After", "Quiet", "Warm", "Golden"], ["Hours", "Room", "Gravity", "Letters", "Weather", "Glow", "Promise", "Theory"]],
  loFiHipHop: [["Dust", "Window", "Sunday", "Quiet", "Paper", "Blue", "Soft", "Late"], ["Radio", "Weather", "Tape", "Coffee", "Frames", "Hours", "Polaroid", "Room"]],
  rock: [["Broken", "Wild", "Open", "Black", "Burning", "Electric", "Last", "Red"], ["Signals", "Road", "Voltage", "Lines", "Weather", "Theory", "Run", "Horizon"]],
  ambient: [["Still", "Distant", "Glass", "Quiet", "Slow", "Pale", "Open", "Weightless"], ["Orbit", "Weather", "Light", "Horizon", "Tide", "Signal", "Dream", "Air"]],
});

const FALLBACK_LEFT = ["After", "Broken", "Chrome", "Distant", "Electric", "Golden", "Midnight", "Neon", "Open", "Quiet", "Satellite", "Velvet"];
const FALLBACK_RIGHT = ["Gravity", "Hours", "Mirage", "Motion", "Radio", "Signal", "Skyline", "Theory", "Tide", "Weather", "Cinema", "Horizon"];

function wordsForGenre(genre) {
  return GENRE_WORDS[genre] ?? [FALLBACK_LEFT, FALLBACK_RIGHT];
}

export function deriveSongTitle(song = {}) {
  if (song?.title) return String(song.title);
  const dna = song?.songDNA ?? song?.songBlueprint?.songDNA;
  const genre = String(song?.meta?.genre ?? song?.genre ?? dna?.identity?.genre ?? "original");
  const identity = dna?.identity ?? {};
  const seed = hash([dna?.familyId, dna?.id, song?.seed, genre, identity.signatureBias, identity.narrative].filter(Boolean).join("|"));
  const [leftWords, rightWords] = wordsForGenre(genre);
  let left = leftWords[seed % leftWords.length];
  let right = rightWords[(seed >>> 8) % rightWords.length];
  if (left.toLowerCase() === right.toLowerCase()) right = rightWords[((seed >>> 8) + 1) % rightWords.length];
  return `${left} ${right}`;
}
