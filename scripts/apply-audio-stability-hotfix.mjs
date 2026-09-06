import fs from "node:fs";

const appPath = "src/app.js";
let source = fs.readFileSync(appPath, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { renderPhrasePerformance } from "./core/phrase-memory.js";\n',
  'import { renderPhrasePerformance } from "./core/phrase-memory.js";\nimport { previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";\n',
  "preview performance import",
);

replaceOnce(
  "    this.scheduledVoices = new Set();\n    this.lastScheduleAt = 0;",
  `    this.scheduledVoices = new Set();\n    this.previewRuntime = previewRuntimeProfile({\n      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,\n      hardwareConcurrency: typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency,\n      deviceMemory: typeof navigator === "undefined" ? 8 : navigator.deviceMemory,\n    });\n    this.lastScheduleAt = 0;`,
  "runtime profile",
);

replaceOnce(
  `  voicePriority(event) {\n    return ({ melody: 6, bass: 5, counterpoint: 4, chords: 3, pad: 3, drums: 2 }[event?.id] || 1)\n      + (event?.spotlight ? 2 : 0);\n  }`,
  `  voicePriority(event) {\n    return previewVoicePriority(event?.id, Boolean(event?.spotlight));\n  }`,
  "voice priority",
);

source = source.replaceAll(
  "PREVIEW_AUDIO_LIMITS.lateEventGraceSeconds",
  "this.previewRuntime.lateEventGraceSeconds",
);

replaceOnce(
  "    const horizon = currentSongTime + PREVIEW_AUDIO_LIMITS.lookAheadSeconds;",
  "    const horizon = currentSongTime + this.previewRuntime.lookAheadSeconds;",
  "scheduler horizon",
);

replaceOnce(
  "    this.timer = setInterval(() => this.schedule(), PREVIEW_AUDIO_LIMITS.scheduleIntervalMs);",
  "    this.timer = setInterval(() => this.schedule(), this.previewRuntime.scheduleIntervalMs);",
  "scheduler interval",
);

replaceOnce(
  `  enforceScheduledVoiceLimit() {\n    while (this.scheduledVoices.size > PREVIEW_AUDIO_LIMITS.maxScheduledVoices) {\n      const victim = [...this.scheduledVoices].sort((left, right) => (\n        left.priority - right.priority || left.startedAt - right.startedAt\n      ))[0];\n      if (!victim) return;\n      this.cleanupScheduledVoice(victim, true);\n    }\n  }`,
  `  enforceScheduledVoiceLimit() {\n    while (this.scheduledVoices.size > this.previewRuntime.maxScheduledVoices) {\n      const victim = selectPreviewVoiceVictim(this.scheduledVoices, {\n        now: this.context?.currentTime ?? 0,\n        maxVoices: this.previewRuntime.maxScheduledVoices,\n      });\n      if (!victim) return;\n      this.cleanupScheduledVoice(victim, true);\n    }\n  }`,
  "voice limiter",
);

const scheduleStart = source.indexOf("  scheduleEvent(event, when) {");
const drumStart = source.indexOf("  scheduleDrum(event, when) {", scheduleStart);
if (scheduleStart < 0 || drumStart < 0) throw new Error("Could not isolate scheduleEvent");
let scheduleEvent = source.slice(scheduleStart, drumStart);

const voiceLine = "    const voice = previewVoice(event.id, event.program, state?.trackSettings?.[event.id]);\n";
if (!scheduleEvent.includes(voiceLine)) throw new Error("Missing scheduled voice creation");
scheduleEvent = scheduleEvent.replace(
  voiceLine,
  `${voiceLine}    const voiceFeatures = previewVoiceFeatures(event.id, this.previewRuntime);\n`,
);

for (const [before, after, label] of [
  ["    if (voice.layer) {", "    if (voice.layer && voiceFeatures.layer) {", "layer gate"],
  ["    if (voice.transientLevel > 0) {", "    if (voice.transientLevel > 0 && voiceFeatures.transient) {", "transient gate"],
  ["    if (voice.subLevel > 0 && targetFrequency >= 48) {", "    if (voice.subLevel > 0 && targetFrequency >= 48 && voiceFeatures.sub) {", "sub gate"],
]) {
  if (!scheduleEvent.includes(before)) throw new Error(`Missing ${label}`);
  scheduleEvent = scheduleEvent.replace(before, after);
}

source = `${source.slice(0, scheduleStart)}${scheduleEvent}${source.slice(drumStart)}`;
fs.writeFileSync(appPath, source);
console.log("Applied Android preview audio stability hotfix.");
