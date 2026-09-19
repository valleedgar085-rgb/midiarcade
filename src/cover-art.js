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
  const bpm = Math.round(Number(song?.bpm ?? song?.tempo ?? song?.meta?.bpm ?? song?.songDNA?.tempo ?? 120));
  const dna = song?.songDNA ?? song?.songBlueprint?.songDNA ?? {};
  const identity = dna?.identity ?? {};
  const seed = hash(`${dna?.familyId ?? song?.seed}:${title}:${identity.signatureBias ?? ""}`);
  const finish = coverArtworkFinish(variation);
  const finishSeed = hash(`${seed}:finish:${finish.id}`);
  const genreSeed = hash(String(identity.genre ?? song?.genre ?? genre));
  const hue = (seed + genreSeed) % 360;
  const hue2 = (hue + 48 + ((seed >>> 8) % 88)) % 360;
  const hue3 = (hue2 + 72) % 360;
  const centerX = 600 + ((seed % 101) - 50);
  const centerY = 510 + (((seed >>> 7) % 81) - 40);
  const energyArc = Array.isArray(dna?.arrangement?.energyArc) ? dna.arrangement.energyArc : [];
  const energy = energyArc.length ? energyArc.reduce((sum, value) => sum + Number(value || 0), 0) / energyArc.length : 0.62;
  const pulseRadius = Math.round(330 + Math.max(0, Math.min(1, energy)) * 105);
  const words = title.split(/\s+/);
  const midpoint = Math.ceil(words.length / 2);
  const lineOne = escapeXml(words.slice(0, midpoint).join(" "));
  const lineTwo = escapeXml(words.slice(midpoint).join(" "));
  const subtitle = escapeXml(`${genre.toUpperCase()} · ${key} ${mode} · ${bpm} BPM`.toUpperCase());
  const foilAngle = 18 + (finishSeed % 54);
  const spikes = Array.from({ length: 48 }, (_, index) => {
    const local = hash(`${seed}:aura:${index}`);
    const angle = (index / 48) * Math.PI * 2;
    const inner = pulseRadius + 12;
    const outer = inner + 18 + (local % 82) * (0.35 + energy * 0.65);
    const x1 = centerX + Math.cos(angle) * inner;
    const y1 = centerY + Math.sin(angle) * inner;
    const x2 = centerX + Math.cos(angle) * outer;
    const y2 = centerY + Math.sin(angle) * outer;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join("");
  const prismTop = 245 - Math.round(energy * 35);
  const prismBottom = 790 + Math.round(energy * 20);
  const prismLeft = 330 - (seed % 46);
  const prismRight = 875 + ((seed >>> 5) % 46);
  const stars = Array.from({ length: 72 }, (_, index) => {
    const local = hash(`${seed}:star:${index}`);
    const x = 35 + (local % 1130);
    const y = 110 + ((local >>> 10) % 720);
    const radius = 0.7 + ((local >>> 20) % 24) / 10;
    const opacity = 0.16 + ((local >>> 24) % 55) / 100;
    return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="white" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  const shards = Array.from({ length: 9 }, (_, index) => {
    const local = hash(`${seed}:shard:${index}`);
    const x = 90 + (local % 1010);
    const y = 160 + ((local >>> 9) % 570);
    const width = 24 + ((local >>> 17) % 86);
    const height = 70 + ((local >>> 23) % 150);
    const rotation = -42 + (local % 84);
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="url(#glassShard)" opacity=".14" transform="rotate(${rotation} ${x + width / 2} ${y + height / 2})"/>`;
  }).join("");
  const ribbons = Array.from({ length: 4 }, (_, index) => {
    const local = hash(`${seed}:ribbon:${index}`);
    const y = 255 + index * 125 + (local % 45);
    const bend = 70 + ((local >>> 8) % 140);
    return `<path d="M-80 ${y} C240 ${y - bend}, 410 ${y + bend}, 650 ${y} S1030 ${y - bend}, 1280 ${y + 18}" fill="none" stroke="hsl(${(hue + index * 38) % 360} 100% 72%)" stroke-opacity=".16" stroke-width="${10 + index * 5}" filter="url(#ribbonBlur)"/>`;
  }).join("");
  const sectionSource = song?.structure ?? song?.songBlueprint?.structure ?? dna?.sections ?? [];
  const sectionCount = Math.max(4, Math.min(12, Array.isArray(sectionSource) ? sectionSource.length : 6));
  const sectionRing = Array.from({ length: sectionCount }, (_, index) => {
    const local = hash(`${seed}:section:${index}`);
    const start = (index / sectionCount) * 360 + 3;
    const span = (360 / sectionCount) - 7;
    const radius = pulseRadius + 66 + (local % 18);
    return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="hsl(${(hue2 + index * 17) % 360} 100% 78%)" stroke-opacity=".34" stroke-width="${3 + (local % 5)}" stroke-dasharray="${Math.max(18, Math.round((2 * Math.PI * radius) * span / 360))} 9999" transform="rotate(${start} ${centerX} ${centerY})"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(title)} cover artwork" data-cover-finish="${finish.id}" data-track-aura="v2">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 8%)"/><stop offset=".48" stop-color="hsl(${hue2} 72% 14%)"/><stop offset="1" stop-color="#03040b"/></linearGradient>
      <radialGradient id="aura"><stop stop-color="hsl(${hue3} 100% 72%)" stop-opacity=".68"/><stop offset=".48" stop-color="hsl(${hue2} 96% 58%)" stop-opacity=".25"/><stop offset="1" stop-color="hsl(${hue} 96% 48%)" stop-opacity="0"/></radialGradient>
      <linearGradient id="glassShard" x1="0" y1="0" x2="1" y2="1"><stop stop-color="white" stop-opacity=".9"/><stop offset=".45" stop-color="hsl(${hue3} 100% 72%)" stop-opacity=".42"/><stop offset="1" stop-color="hsl(${hue} 100% 54%)" stop-opacity=".08"/></linearGradient>\n      <linearGradient id="prism" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue3} 100% 88%)"/><stop offset=".35" stop-color="hsl(${hue2} 96% 64%)"/><stop offset=".7" stop-color="hsl(${hue} 96% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 25) % 360} 100% 70%)"/></linearGradient>
      <linearGradient id="finishSheen" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${foilAngle} .5 .5)"><stop stop-color="white" stop-opacity="0"/><stop offset=".48" stop-color="white" stop-opacity="${finish.gloss}"/><stop offset=".58" stop-color="hsl(${hue3} 100% 82%)" stop-opacity="${finish.id === "foil" ? 0.2 : finish.gloss * 0.35}"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="48"/></filter>\n      <filter id="ribbonBlur"><feGaussianBlur stdDeviation="16"/></filter>\n      <filter id="prismDepth"><feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="black" flood-opacity=".52"/><feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="hsl(${hue3} 100% 68%)" flood-opacity=".42"/></filter>
      <filter id="glow"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="${finishSeed % 97}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${finish.grain} 0"/></filter>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="white" stroke-opacity="${finish.grid * 0.55}"/></pattern>
    </defs>
    <rect width="1200" height="1200" rx="48" fill="url(#bg)"/>
    <rect width="1200" height="1200" rx="48" fill="url(#grid)"/>\n    <g>${stars}</g>\n    <g>${ribbons}</g>\n    <g>${shards}</g>
    <circle cx="${centerX}" cy="${centerY}" r="${pulseRadius + 120}" fill="url(#aura)" filter="url(#blur)"/>
    <g fill="none" stroke="white" stroke-opacity=".42" stroke-linecap="round" filter="url(#glow)">${spikes}</g>
    <g>${sectionRing}</g>\n    <circle cx="${centerX}" cy="${centerY}" r="${pulseRadius}" fill="none" stroke="hsl(${hue3} 100% 76%)" stroke-opacity=".62" stroke-width="3"/>
    <g filter="url(#prismDepth)">
      <path d="M${centerX} ${prismTop} L${prismRight} ${prismBottom} L${centerX} ${prismBottom - 105} L${prismLeft} ${prismBottom} Z" fill="url(#prism)" fill-opacity=".28" stroke="url(#prism)" stroke-width="10"/>\n      <path d="M${centerX} ${prismTop + 18} L${prismRight - 24} ${prismBottom - 12}" fill="none" stroke="white" stroke-opacity=".72" stroke-width="3"/>\n      <path d="M${centerX} ${prismTop + 18} L${prismLeft + 24} ${prismBottom - 12}" fill="none" stroke="white" stroke-opacity=".38" stroke-width="2"/>
      <path d="M${centerX} ${prismTop} L${centerX} ${prismBottom - 105} L${prismLeft} ${prismBottom} Z" fill="hsl(${hue} 88% 34%)" fill-opacity=".45" stroke="white" stroke-opacity=".22"/>
      <path d="M${centerX} ${prismTop} L${prismRight} ${prismBottom} L${centerX} ${prismBottom - 105} Z" fill="hsl(${hue3} 96% 66%)" fill-opacity=".34" stroke="white" stroke-opacity=".3"/>
    </g>
    ${finish.grain > 0 ? '<rect width="1200" height="1200" rx="48" filter="url(#grain)" opacity=".72"/>' : ""}
    <rect width="1200" height="1200" rx="48" fill="url(#finishSheen)"/>
    <rect x="12" y="12" width="1176" height="1176" rx="40" fill="none" stroke="white" stroke-opacity="${finish.edge}"/>
    <text x="72" y="82" fill="white" fill-opacity=".7" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="7">MIDI ARCADE · TRACK AURA</text>
    <text x="72" y="${lineTwo ? 925 : 970}" fill="white" font-family="Outfit,Arial,sans-serif" font-size="${title.length > 28 ? 80 : 102}" font-weight="800" letter-spacing="-3">${lineOne}</text>
    ${lineTwo ? `<text x="72" y="1018" fill="white" font-family="Outfit,Arial,sans-serif" font-size="${title.length > 28 ? 80 : 102}" font-weight="800" letter-spacing="-3">${lineTwo}</text>` : ""}
    <text x="76" y="1100" fill="white" fill-opacity=".76" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="650" letter-spacing="4">${subtitle}</text>
  </svg>`;
}
export function coverArtworkDataUrl(song, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverArtworkSvg(song, options))}`;
}
