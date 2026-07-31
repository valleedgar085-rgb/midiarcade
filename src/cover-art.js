function hash(text) {
  let value = 2166136261;
  for (const character of String(text)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const COVER_FINISHES = Object.freeze([
  Object.freeze({ id: "original", label: "Original", grain: 0, gloss: 0.08, grid: 0.055, edge: 0.12 }),
  Object.freeze({ id: "matte", label: "Matte", grain: 0.035, gloss: 0.025, grid: 0.042, edge: 0.08 }),
  Object.freeze({ id: "soft-grain", label: "Soft Grain", grain: 0.095, gloss: 0.045, grid: 0.04, edge: 0.1 }),
  Object.freeze({ id: "glass", label: "Glass", grain: 0.018, gloss: 0.19, grid: 0.06, edge: 0.16 }),
  Object.freeze({ id: "foil", label: "Foil", grain: 0.05, gloss: 0.13, grid: 0.05, edge: 0.22 }),
]);

export function coverArtworkFinish(variation = 0) {
  const index = Math.abs(Math.trunc(Number(variation) || 0)) % COVER_FINISHES.length;
  return COVER_FINISHES[index];
}

export function createCoverArtworkSvg(song, { variation = 0, size = 1200 } = {}) {
  const title = String(song?.title || "Untitled Idea").slice(0, 48);
  const genre = String(song?.meta?.genreLabel || song?.genre || "Original composition");
  const key = String(song?.meta?.key || song?.key || "C");
  const mode = String(song?.meta?.scale || song?.mode || "major").replace(/([a-z])([A-Z])/g, "$1 $2");
  // The song owns one permanent composition. Finish variations alter only the
  // simulated surface treatment, never its palette, geometry, or typography.
  const seed = hash(`${song?.seed}:${title}`);
  const finish = coverArtworkFinish(variation);
  const finishSeed = hash(`${seed}:finish:${finish.id}`);
  const hue = seed % 360;
  const hue2 = (hue + 62 + ((seed >>> 8) % 96)) % 360;
  const hue3 = (hue2 + 78) % 360;
  const x = 28 + (seed % 45);
  const y = 24 + ((seed >>> 7) % 48);
  const words = title.split(/\s+/);
  const midpoint = Math.ceil(words.length / 2);
  const lineOne = escapeXml(words.slice(0, midpoint).join(" "));
  const lineTwo = escapeXml(words.slice(midpoint).join(" "));
  const subtitle = escapeXml(`${genre.toUpperCase()} · ${key} ${mode}`.toUpperCase());

  const foilAngle = 18 + (finishSeed % 54);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(title)} cover artwork" data-cover-finish="${finish.id}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 64% 10%)"/><stop offset=".55" stop-color="hsl(${hue2} 70% 17%)"/><stop offset="1" stop-color="#050508"/></linearGradient>
      <radialGradient id="orb"><stop stop-color="hsl(${hue3} 98% 76%)" stop-opacity=".96"/><stop offset=".42" stop-color="hsl(${hue2} 92% 58%)" stop-opacity=".56"/><stop offset="1" stop-color="hsl(${hue} 90% 48%)" stop-opacity="0"/></radialGradient>
      <linearGradient id="finishSheen" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${foilAngle} .5 .5)"><stop stop-color="white" stop-opacity="0"/><stop offset=".48" stop-color="white" stop-opacity="${finish.gloss}"/><stop offset=".58" stop-color="hsl(${hue3} 100% 82%)" stop-opacity="${finish.id === "foil" ? 0.2 : finish.gloss * 0.35}"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="${finishSeed % 97}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${finish.grain} 0"/></filter>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="white" stroke-opacity="${finish.grid}"/></pattern>
    </defs>
    <rect width="1200" height="1200" rx="48" fill="url(#bg)"/>
    <rect width="1200" height="1200" rx="48" fill="url(#grid)"/>
    <circle cx="${x * 12}" cy="${y * 12}" r="430" fill="url(#orb)" filter="url(#blur)"/>
    <g fill="none" stroke="white" stroke-opacity=".32">
      <ellipse cx="${x * 12}" cy="${y * 12}" rx="430" ry="190" transform="rotate(${seed % 160} ${x * 12} ${y * 12})"/>
      <ellipse cx="${x * 12}" cy="${y * 12}" rx="330" ry="510" transform="rotate(${(seed >>> 5) % 150} ${x * 12} ${y * 12})"/>
    </g>
    ${finish.grain > 0 ? '<rect width="1200" height="1200" rx="48" filter="url(#grain)" opacity=".72"/>' : ""}
    <rect width="1200" height="1200" rx="48" fill="url(#finishSheen)"/>
    <rect x="12" y="12" width="1176" height="1176" rx="40" fill="none" stroke="white" stroke-opacity="${finish.edge}"/>
    <path d="M90 118H1110" stroke="white" stroke-opacity=".28"/>
    <text x="90" y="92" fill="white" fill-opacity=".74" font-family="Inter,Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="8">MIDI ARCADE · ORIGINAL ${String(seed).slice(0, 7)}</text>
    <text x="90" y="${lineTwo ? 910 : 960}" fill="white" font-family="Outfit,Arial,sans-serif" font-size="${title.length > 28 ? 86 : 108}" font-weight="800" letter-spacing="-3">${lineOne}</text>
    ${lineTwo ? `<text x="90" y="1012" fill="white" font-family="Outfit,Arial,sans-serif" font-size="${title.length > 28 ? 86 : 108}" font-weight="800" letter-spacing="-3">${lineTwo}</text>` : ""}
    <text x="94" y="1100" fill="white" fill-opacity=".72" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="650" letter-spacing="5">${subtitle}</text>
  </svg>`;
}

export function coverArtworkDataUrl(song, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverArtworkSvg(song, options))}`;
}
