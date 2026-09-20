const GENRE_ALIASES = Object.freeze({
  pop: "pop",
  "pop radio": "popRadio",
  popradio: "popRadio",
  hiphop: "hipHop",
  "hip hop": "hipHop",
  "hip-hop": "hipHop",
  rap: "rap",
  trap: "trap",
  drill: "drill",
  jazz: "jazz",
  funk: "funk",
  rock: "rock",
  ambient: "ambient",
  synthwave: "synthwave",
  "synth pop radio": "synthPopRadio",
  "synth-pop radio": "synthPopRadio",
  synthpopradio: "synthPopRadio",
  techno: "techno",
  "drum bass": "drumBass",
  "drum & bass": "drumBass",
  "drum and bass": "drumBass",
  drumbass: "drumBass",
  dnb: "drumBass",
  "rnb soul": "rnbSoul",
  "r&b soul": "rnbSoul",
  rnbsoul: "rnbSoul",
  rnb: "rnbSoul",
  "r&b": "rnbSoul",
  "lo fi hip hop": "loFiHipHop",
  "lo-fi hip-hop": "loFiHipHop",
  lofihiphop: "loFiHipHop",
  lofi: "loFiHipHop",
  chillhop: "loFiHipHop",
  "neo soul": "neoSoul",
  neosoul: "neoSoul",
  "rhythm and blues": "rnbSoul",
  rhythmandblues: "rnbSoul",
  soul: "rnbSoul",
  "slow jam": "rnbSoul",
  slowjam: "rnbSoul",
  jungle: "drumBass",
  retrowave: "synthwave",
  "uk drill": "drill",
  ukdrill: "drill",
  dembow: "reggaeton",
  afropop: "afrobeats",
  swing: "jazz",
  chillout: "ambient",
  downtempo: "ambient",
  groove: "funk",
  americana: "country",
  "alt rock": "rock",
  altrock: "rock",
  "alternative rock": "rock",
  alternativerock: "rock",
});

function aliasKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Normalize external/UI genre aliases without inventing a fallback genre.
 * Unknown non-empty ids are preserved so existing calibrated genres continue
 * to flow through untouched.
 */
export function normalizeGenreId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const key = aliasKey(raw);
  return GENRE_ALIASES[key]
    ?? GENRE_ALIASES[key.replace(/[-]/g, " ")]
    ?? raw;
}

export function genrePair(primary, secondary) {
  return Object.freeze({
    primary: normalizeGenreId(primary),
    secondary: normalizeGenreId(secondary),
  });
}
