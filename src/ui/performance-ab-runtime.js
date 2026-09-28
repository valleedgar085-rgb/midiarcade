import { createPerformanceAuditionSong, performanceAuditionEligibility } from "../core/performance-audition.js";
import { ensurePerformanceAbControls } from "./performance-ab-controls.js";

export function mountPerformanceAbDebugger({ dialog, player, getSong, render, toast }) {
  if (!dialog) return;
  ensurePerformanceAbControls(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  const status = () => {
    const song = getSong();
    const eligibility = performanceAuditionEligibility(song);
    const audition = player.performanceAudition;
    const performed = $("#performanceAbPerformed");
    if (performed) performed.disabled = !eligibility.allowed;
    const label = $("#performanceAbStatus");
    if (label) label.textContent = !eligibility.allowed
      ? "B paused."
      : audition?.mode === "performance"
        ? `B · ${Math.round((audition.humanize ?? 0.65) * 100)}% · ${audition.report?.metrics?.timing?.maxAbsMs ?? 0} ms`
        : audition ? "A" : "A · B preview";
  };
  const end = async () => {
    if (!player.performanceAudition) return;
    const position = player.currentSongTime();
    player.performanceAudition = null;
    await player.returnToCanonicalSong({ positionSeconds: position, resume: false });
    status();
    render();
  };
  const audition = async (mode) => {
    const song = getSong();
    if (!song) return toast("Generate a song first.");
    try {
      const position = player.currentSongTime();
      if (mode === "current") {
        player.performanceAudition = { mode, report: player.performanceAudition?.report ?? null };
        await player.auditionSong(song, { startSeconds: position });
      } else {
        const pair = createPerformanceAuditionSong(song, {
          humanize: 0.65,
          seed: `${song.seed ?? song.id ?? "song"}:performance-ab`,
        });
        player.performanceAudition = {
          mode,
          humanize: pair.performanceSong.performanceAudition.humanize,
          report: pair.report,
        };
        await player.auditionSong(pair.performanceSong, { startSeconds: position });
      }
      status();
      render();
      toast(mode === "performance" ? "B preview active." : "A current song active.");
    } catch (error) {
      console.error("A/B failed", error);
      toast("A/B blocked.");
      status();
    }
  };

  if (!dialog.dataset.performanceAbBound) {
    dialog.dataset.performanceAbBound = "true";
    $("#performanceAbCurrent")?.addEventListener("click", () => void audition("current"));
    $("#performanceAbPerformed")?.addEventListener("click", () => void audition("performance"));
    $("#performanceAbEnd")?.addEventListener("click", () => void end());
    $("#closeDebugger")?.addEventListener("click", () => void end());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) void end();
    });
  }
  status();
}
