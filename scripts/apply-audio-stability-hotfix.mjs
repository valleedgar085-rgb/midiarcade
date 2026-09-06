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

const smokePath = "tests/app-smoke.test.mjs";
let smoke = fs.readFileSync(smokePath, "utf8");
const oldSmoke = `  const boundedPlayer = new app.PreviewPlayer();\n  const boundedSources = Array.from({ length: app.PREVIEW_AUDIO_LIMITS.maxScheduledVoices + 1 }, () => makeAudioNode());\n  boundedSources.forEach((source, index) => {\n    boundedPlayer.registerScheduledVoice([source], [source], { id: "drums" }, index);\n  });\n  assert.equal(boundedPlayer.scheduledVoices.size, app.PREVIEW_AUDIO_LIMITS.maxScheduledVoices);\n  assert.equal(boundedSources[0].stopped, 1, "the oldest low-priority voice must be released at the ceiling");\n  boundedPlayer.clearScheduledAudio();\n  assert.equal(boundedPlayer.scheduledVoices.size, 0);`;
const newSmoke = `  const boundedPlayer = new app.PreviewPlayer();\n  boundedPlayer.context = { currentTime: 0 };\n  const runtimeVoiceLimit = boundedPlayer.previewRuntime.maxScheduledVoices;\n  const boundedSources = Array.from({ length: runtimeVoiceLimit + 1 }, () => makeAudioNode());\n  boundedSources.forEach((source, index) => {\n    boundedPlayer.registerScheduledVoice([source], [source], { id: index === 0 ? "melody" : "pad" }, index * 0.05);\n  });\n  assert.equal(boundedPlayer.scheduledVoices.size, runtimeVoiceLimit);\n  assert.equal(boundedSources[0].stopped, 0, "an already-audible lead must survive scheduler pressure");\n  assert.ok(boundedSources.slice(1).some((source) => source.stopped === 1), "a future low-priority voice must yield first");\n  boundedPlayer.clearScheduledAudio();\n  assert.equal(boundedPlayer.scheduledVoices.size, 0);`;
if (!smoke.includes(oldSmoke)) throw new Error("Missing adaptive voice-limit smoke target");
smoke = smoke.replace(oldSmoke, newSmoke);
fs.writeFileSync(smokePath, smoke);

console.log("Applied Android preview audio stability hotfix.");
