const DRUM_ROLE_BY_PITCH = Object.freeze({
  35: "kick", 36: "kick",
  37: "snare", 38: "snare", 40: "snare",
  39: "clap",
  42: "hat", 44: "hat",
  46: "openHat",
  49: "cymbal", 51: "cymbal", 52: "cymbal", 55: "cymbal", 57: "cymbal", 59: "cymbal",
  41: "tom", 43: "tom", 45: "tom", 47: "tom", 48: "tom", 50: "tom",
});

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function drumSampleRole(pitch) {
  return DRUM_ROLE_BY_PITCH[Number(pitch)] ?? null;
}

export function normalizeSampleEntry(entry) {
  if (typeof entry === "string") return { path: entry };
  if (!entry || typeof entry !== "object" || typeof entry.path !== "string") return null;
  return {
    path: entry.path,
    rootMidi: Number.isFinite(Number(entry.rootMidi)) ? Number(entry.rootMidi) : null,
    gain: Number.isFinite(Number(entry.gain)) ? Number(entry.gain) : 1,
  };
}

export function normalizeSampleManifest(manifest = {}) {
  const normalizeList = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeSampleEntry)
    .filter(Boolean);
  const roles = manifest.roles && typeof manifest.roles === "object" ? manifest.roles : {};
  return Object.freeze({
    id: String(manifest.id || "external-one-shots"),
    roles: Object.freeze({
      kick: Object.freeze(normalizeList(roles.kick)),
      snare: Object.freeze(normalizeList(roles.snare)),
      clap: Object.freeze(normalizeList(roles.clap)),
      hat: Object.freeze(normalizeList(roles.hat)),
      hatAccent: Object.freeze(normalizeList(roles.hatAccent)),
      openHat: Object.freeze(normalizeList(roles.openHat)),
      cymbal: Object.freeze(normalizeList(roles.cymbal)),
      tom: Object.freeze(normalizeList(roles.tom)),
      bass808: Object.freeze(normalizeList(roles.bass808)),
    }),
  });
}

export function resolveSampleEntry(manifest, role, seed = 0) {
  const entries = manifest?.roles?.[role] ?? [];
  if (!entries.length) return null;
  return entries[hashSeed(`${manifest.id}:${role}:${seed}`) % entries.length] ?? null;
}

export function resolveDrumSampleEntry(manifest, pitch, seed = 0) {
  const role = drumSampleRole(pitch);
  return role ? resolveSampleEntry(manifest, role, seed) : null;
}

export function resolve808SampleEntry(manifest, targetMidi, seed = 0) {
  const entries = manifest?.roles?.bass808 ?? [];
  if (!entries.length) return null;
  const target = Number(targetMidi);
  const rooted = entries.filter((entry) => Number.isFinite(entry.rootMidi));
  if (!rooted.length) return resolveSampleEntry(manifest, "bass808", seed);
  return [...rooted].sort((a, b) => {
    const distance = Math.abs(a.rootMidi - target) - Math.abs(b.rootMidi - target);
    if (distance) return distance;
    return hashSeed(`${a.path}:${seed}`) - hashSeed(`${b.path}:${seed}`);
  })[0];
}

export function resolveSampleUrl(manifestUrl, assetPath, baseUrl = null) {
  const base = baseUrl || (typeof window !== "undefined" ? window.location.href : "https://localhost/");
  return new URL(assetPath, new URL(manifestUrl, base)).toString();
}
