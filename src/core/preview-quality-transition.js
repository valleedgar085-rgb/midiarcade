import { normalizePreviewQuality, previewGraphBudget } from "./preview-performance.js";
import { PREVIEW_TRANSITION, rampAudioParamValue } from "./preview-audio.js";

/** Switch only at a stopped playback boundary, never in the middle of a note. */
export function synchronizePreviewQuality(player, getQuality, {
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
} = {}) {
  if (player.qualityTransition) return player.qualityTransition;
  if (player.playing || player.liveVoices.size ||
      player.previewRuntime.quality === normalizePreviewQuality(getQuality())) return Promise.resolve(false);
  const context = player.context;
  const change = (async () => {
    if (context?.state === "running" && player.master?.gain) {
      const fade = player.previewBudget.masterFadeSeconds;
      rampAudioParamValue(player.master.gain, 0.0001, context.currentTime, fade);
      // Wait for the actual output fade and defined source tail, not an
      // arbitrary scheduling delay. Existing voices cannot be cut mid-wave.
      await wait(Math.ceil((fade + PREVIEW_TRANSITION.sourceTailSeconds) * 1000));
    }
    if (player.context !== context || player.playing || player.liveVoices.size) return false;
    if (context && context.state !== "closed") {
      const stateChangeHandler = context.onstatechange;
      context.onstatechange = null;
      try {
        await context.close();
      } catch (error) {
        if (player.context === context && context.state !== "closed") context.onstatechange = stateChangeHandler;
        throw error;
      }
    }
    if (player.context !== context) return false;
    player.resetContextReferences(context);
    // Last selection wins if the user changes the menu during the fade.
    player.previewRuntime = { ...player.previewRuntime, quality: normalizePreviewQuality(getQuality()) };
    player.previewBudget = previewGraphBudget(player.previewRuntime);
    return true;
  })();
  const transition = change.finally(() => {
    if (player.qualityTransition === transition) player.qualityTransition = null;
  });
  player.qualityTransition = transition;
  return transition;
}
