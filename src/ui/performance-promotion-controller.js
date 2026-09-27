import {
  acceptPerformanceCandidate,
  createPerformanceCandidate,
} from "../core/performance-candidate.js";

export function createPerformancePromotionController({
  player,
  state,
  appStore,
  clamp,
  totalSeconds,
  createHistorySnapshot,
  pushHistory,
  applyTrackSettingsToSong,
  renderAll,
  updatePlaybackUi,
  playbackViewForSong,
  scheduleSessionSave,
  renderGenerationDebugger,
  showToast,
}) {
  async function audition(mode) {
    if (!state.song) return showToast("Generate a song first."), false;
    player.performanceCandidate = null;
    try {
      await player.auditionPerformanceAB(mode, { humanize: 0.65 });
      renderGenerationDebugger();
      showToast(mode === "performance" ? "B preview active." : "A current song active.");
      return true;
    } catch (error) {
      console.error("A/B failed", error);
      showToast("A/B blocked.");
      renderGenerationDebugger();
      return false;
    }
  }

  async function validate() {
    if (!state.song) return showToast("Generate a song first."), false;
    showToast("Validating Performance B...");
    const transaction = createPerformanceCandidate(state.song, {
      humanize: 0.65,
      seed: `${state.song.seed ?? state.song.id ?? "song"}:performance-candidate`,
    });
    player.performanceCandidate = transaction;
    if (!transaction.validation?.valid) {
      renderGenerationDebugger();
      showToast("Performance B did not pass promotion.");
      return false;
    }
    const position = player.currentSongTime();
    player.performanceAudition = {
      mode: "performance",
      humanize: transaction.selectedHumanize,
      report: transaction.report,
    };
    await player.auditionSong(transaction.after, { startSeconds: position });
    renderGenerationDebugger();
    showToast(`B validated at ${Math.round(transaction.selectedHumanize * 100)}%.`);
    return true;
  }

  async function accept() {
    const transaction = player.performanceCandidate;
    if (!transaction?.validation?.valid) return showToast("Validate B first."), false;
    const snapshot = createHistorySnapshot();
    const position = player.currentSongTime();
    const accepted = acceptPerformanceCandidate(transaction);
    applyTrackSettingsToSong(accepted);
    player.stop();
    if (snapshot) pushHistory(snapshot);
    appStore.transaction("performance:accept", (draft) => {
      draft.song = accepted;
    });
    player.performanceAudition = null;
    player.performanceCandidate = null;
    player.playbackSong = state.song;
    player.position = clamp(position, 0, totalSeconds(state.song));
    renderAll();
    updatePlaybackUi(player.position, totalSeconds(state.song), {
      view: playbackViewForSong(state.song),
    });
    scheduleSessionSave();
    renderGenerationDebugger();
    showToast("Performance B accepted. Undo is available.");
    return true;
  }

  async function reject() {
    player.performanceCandidate = null;
    await player.auditionPerformanceAB("current");
    renderGenerationDebugger();
    showToast("Performance B rejected.");
    return true;
  }

  async function end() {
    await player.endPerformanceAB();
    renderGenerationDebugger();
    return true;
  }

  return Object.freeze({ audition, validate, accept, reject, end });
}
