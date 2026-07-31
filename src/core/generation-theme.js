const PALETTES = Object.freeze([
  { id: "violet-nebula", hue: 258, accent: "#a77bff", accent2: "#d58cff", accent3: "#ff83da", bg: "#08070d", bg1: "#100d19", bg2: "#171225", bg3: "#211936" },
  { id: "electric-ocean", hue: 194, accent: "#4cc9ff", accent2: "#58e6d9", accent3: "#7affaa", bg: "#050b10", bg1: "#08151d", bg2: "#0c202a", bg3: "#112d39" },
  { id: "solar-ember", hue: 22, accent: "#ff875f", accent2: "#ffc15c", accent3: "#ff668f", bg: "#0d0806", bg1: "#1a0e0a", bg2: "#26140e", bg3: "#351c14" },
  { id: "midnight-rose", hue: 326, accent: "#ff70b7", accent2: "#d98cff", accent3: "#ff9c78", bg: "#0d070c", bg1: "#180d17", bg2: "#241221", bg3: "#33182d" },
  { id: "acid-forest", hue: 142, accent: "#66e98e", accent2: "#b5e85c", accent3: "#42d9c4", bg: "#060c08", bg1: "#0b1710", bg2: "#102219", bg3: "#173023" },
  { id: "blue-hour", hue: 222, accent: "#719cff", accent2: "#8c7cff", accent3: "#56d7ff", bg: "#060810", bg1: "#0b1020", bg2: "#10182d", bg3: "#17213e" },
]);

const PATTERNS = Object.freeze(["orbit", "prism", "waves", "constellation", "horizon", "pulse"]);

function hash(value) {
  let result = 2166136261;
  for (const character of String(value ?? "")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function generationTheme(song) {
  const identity = [
    song?.seed,
    song?.id,
    song?.meta?.genre || song?.genre,
    song?.meta?.key || song?.key,
    song?.meta?.scale || song?.mode,
  ].join(":");
  const value = hash(identity);
  const mixed = (value ^ (value >>> 11) ^ (value >>> 21)) >>> 0;
  const palette = PALETTES[mixed % PALETTES.length];
  const pattern = PATTERNS[((mixed >>> 7) ^ mixed) % PATTERNS.length];
  const secondaryHue = (palette.hue + 46 + ((value >>> 16) % 92)) % 360;
  return Object.freeze({
    ...palette,
    pattern,
    secondaryHue,
    glowX: 18 + (value % 65),
    glowY: 12 + ((value >>> 9) % 70),
  });
}

export function applyGenerationTheme(root, song) {
  if (!root?.style || !root?.dataset || !song) return null;
  const theme = generationTheme(song);
  root.dataset.generationTheme = theme.id;
  root.dataset.generationPattern = theme.pattern;
  const properties = {
    "--accent": theme.accent,
    "--accent-2": theme.accent2,
    "--accent-3": theme.accent3,
    "--bg": theme.bg,
    "--bg-1": theme.bg1,
    "--bg-2": theme.bg2,
    "--bg-3": theme.bg3,
    "--generation-hue": theme.hue,
    "--generation-hue-2": theme.secondaryHue,
    "--generation-glow-x": `${theme.glowX}%`,
    "--generation-glow-y": `${theme.glowY}%`,
  };
  for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
  return theme;
}
