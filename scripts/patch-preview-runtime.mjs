import { readFile, writeFile } from "node:fs/promises";

const path = "src/app.js";
let source = await readFile(path, "utf8");

function replaceExact(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  source = source.replace(before, after);
}

replaceExact(
  "preview-audio import",
  `  characteristicTrackForPreview,\n  clickSafeStopTime,\n  normalizeMixAssistant,`,
  `  characteristicTrackForPreview,\n  clickSafeStopTime,\n  rampAudioParamValue,\n  normalizeMixAssistant,`,
);

replaceExact(
  "master play ramp",
  `    if (this.master?.gain) {\n      try {\n        const now = this.context.currentTime;\n        this.master.gain.cancelScheduledValues(now);\n        this.master.gain.setValueAtTime(0.0001, now);\n        this.master.gain.exponentialRampToValueAtTime(0.42, now + this.previewBudget.masterFadeSeconds);\n      } catch {\n        this.master.gain.value = 0.42;\n      }\n    }`,
  `    if (this.master?.gain) {\n      const now = this.context.currentTime;\n      rampAudioParamValue(this.master.gain, 0.42, now, this.previewBudget.masterFadeSeconds);\n    }`,
);

replaceExact(
  "loop restart dispatch",
  `      if (state.loop) {\n        this.position = 0;\n        this.clearTimers();\n        this.playing = false;\n        this.play();\n        return;\n      }`,
  `      if (state.loop) {\n        this.restartLoopPlayback();\n        return;\n      }`,
);

replaceExact(
  "loop restart method insertion",
  `  updateFrame() {\n`,
  `  restartLoopPlayback() {\n    if (!this.playing || !this.context) return;\n    this.clearTimers();\n    this.clearScheduledAudio();\n    this.resetDynamicBuses();\n    this.position = 0;\n    this.offset = 0;\n    this.startedAt = this.context.currentTime;\n    this.eventIndex = 0;\n    this.lastScheduleAt = this.context.currentTime;\n    this.schedule();\n    this.timer = setInterval(() => this.schedule(), this.previewRuntime.scheduleIntervalMs);\n    this.updateFrame();\n  }\n\n  updateFrame() {\n`,
);

replaceExact(
  "pause master ramp ordering",
  `    this.clearTimers();\n    this.clearScheduledAudio();\n    this.resetDynamicBuses();\n    if (this.context && this.master?.gain) {\n      try {\n        const now = this.context.currentTime;\n        this.master.gain.cancelScheduledValues(now);\n        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);\n        this.master.gain.exponentialRampToValueAtTime(0.0001, now + this.previewBudget.masterFadeSeconds);\n      } catch { /* ignore */ }\n    }`,
  `    this.clearTimers();\n    if (this.context && this.master?.gain) {\n      const now = this.context.currentTime;\n      rampAudioParamValue(this.master.gain, 0.0001, now, this.previewBudget.masterFadeSeconds);\n    }\n    this.clearScheduledAudio();\n    this.resetDynamicBuses();`,
);

await writeFile(path, source);
console.log("PreviewPlayer continuity patch applied successfully.");
