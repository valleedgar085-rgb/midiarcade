/**
 * Shared primitive utilities.
 *
 * Intentionally minimal — only pure, dependency-free functions that are used
 * in more than one module. music-engine.js is excluded by design (it is
 * explicitly dependency-free and maintains its own private copies).
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
