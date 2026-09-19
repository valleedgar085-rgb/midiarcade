export const ROLE_REGISTER_WINDOWS = Object.freeze({
  bass: Object.freeze({ min: 28, max: 55, preferredMin: 35, preferredMax: 52 }),
  chords: Object.freeze({ min: 40, max: 79, preferredMin: 48, preferredMax: 72 }),
  melody: Object.freeze({ min: 48, max: 84, preferredMin: 57, preferredMax: 79 }),
  counterpoint: Object.freeze({ min: 48, max: 84, preferredMin: 55, preferredMax: 79 }),
  pad: Object.freeze({ min: 36, max: 79, preferredMin: 43, preferredMax: 72 }),
});

export function roleRegisterWindow(trackId) {
  return ROLE_REGISTER_WINDOWS[String(trackId ?? "")] ?? null;
}

export function rolePreferredRegisterWindow(trackId) {
  const window = roleRegisterWindow(trackId);
  if (!window) return null;
  return Object.freeze({
    min: window.preferredMin ?? window.min,
    max: window.preferredMax ?? window.max,
  });
}

export function roleRegisterViolations(song, {
  checkFloor = false,
} = {}) {
  const violations = [];
  for (const track of song?.tracks ?? []) {
    const window = roleRegisterWindow(track?.id);
    if (!window) continue;
    for (const note of track?.notes ?? []) {
      const pitch = Number(note?.pitch);
      if (!Number.isFinite(pitch)) continue;
      if (pitch > window.max || (checkFloor && pitch < window.min)) {
        violations.push(Object.freeze({
          trackId: track.id,
          pitch,
          min: window.min,
          max: window.max,
          direction: pitch > window.max ? "high" : "low",
        }));
      }
    }
  }
  return Object.freeze(violations);
}

export function isRoleRegisterSafe(song, options = {}) {
  return roleRegisterViolations(song, options).length === 0;
}
