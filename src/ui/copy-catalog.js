export const GENERATION_INTENT_COPY = Object.freeze({
  active: Object.freeze({
    label: "CURRENT SONG",
    title: "Direction locked to active song",
    body: "Change a setting to stage a new direction. Your current song stays untouched.",
  }),
  staged: Object.freeze({
    label: "SETTINGS STAGED",
    title: "Direction ready for the next composition",
    body: "New song idea uses every choice above and replaces the full arrangement without resetting your settings.",
  }),
});

export const GENERATION_STATUS_COPY = Object.freeze({
  new: Object.freeze({
    busy: "COMPOSING HARMONIC ARCHITECTURE",
    thread: "Composing harmony, rhythm, and arrangement…",
    ready: "A complete new composition is ready.",
  }),
  similar: Object.freeze({
    busy: "EVOLVING MUSICAL DNA",
    thread: "Evolving the shared musical DNA…",
    ready: "A related composition preserved the spark and reshaped the journey.",
  }),
  songVariations: Object.freeze({
    busy: "AUDITIONING SIX COMPLETE ARRANGEMENTS",
    thread: "Comparing pocket, hook, and song-journey directions…",
    ready: "Three related full-song directions are ready to compare.",
  }),
});

export function generationIntentCopy(staged) {
  return staged ? GENERATION_INTENT_COPY.staged : GENERATION_INTENT_COPY.active;
}

export function trackRewriteStatus(trackName) {
  const label = String(trackName || "TRACK").toUpperCase();
  return `RECOMPOSING ${label === "DRUMS" ? "DRUM" : label} TRACK`;
}

export function qualityTier(score) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (value >= 98) return Object.freeze({ id: "exceptional", label: "EXCEPTIONAL", nextTarget: 100 });
  if (value >= 95) return Object.freeze({ id: "release", label: "RELEASE READY", nextTarget: 98 });
  if (value >= 92) return Object.freeze({ id: "studio", label: "STUDIO READY", nextTarget: 95 });
  if (value >= 88) return Object.freeze({ id: "strong", label: "STRONG DRAFT", nextTarget: 92 });
  return Object.freeze({ id: "polish", label: "NEEDS POLISH", nextTarget: 88 });
}
