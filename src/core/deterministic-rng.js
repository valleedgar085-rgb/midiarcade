export function hash32(value, fallback = "") {
  let hash = 2166136261;
  const source = String(value ?? fallback);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed, salt = "") {
  let state = hash32(`${seed}|${salt}`) || 0x9e3779b9;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}
