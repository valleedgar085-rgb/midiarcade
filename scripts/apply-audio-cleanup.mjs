import fs from "node:fs";

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} anchor not found`);
  return source.replace(before, after);
}

let app = fs.readFileSync("src/app.js", "utf8");
let audio = fs.readFileSync("src/core/preview-audio.js", "utf8");

app = replaceExact(
  app,
  `import { previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";`,
  `import { previewGraphBudget, previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";`,
  "preview graph budget import",
);

app = replaceExact(
  app,
  `    this.previewRuntime = previewRuntimeProfile({\n      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,\n      hardwareConcurrency: typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency,\n      deviceMemory: typeof navigator === "undefined" ? 8 : navigator.deviceMemory,\n    });\n    this.lastScheduleAt = 0;`,
  `    this.previewRuntime = previewRuntimeProfile({\n      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,\n      hardwareConcurrency: typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency,\n      deviceMemory: typeof navigator === "undefined" ? 8 : navigator.deviceMemory,\n    });\n    this.previewBudget = previewGraphBudget(this.previewRuntime);\n    this.lastScheduleAt = 0;`,
  "preview graph budget initialization",
);

app = replaceExact(
  app,
  `      if (typeof this.context.createWaveShaper === "function") {`,
  `      if (this.previewBudget.saturation && typeof this.context.createWaveShaper === "function") {`,
  "mobile saturation bypass",
);

app = replaceExact(
  app,
  `        saturation.oversample = "4x";`,
  `        saturation.oversample = this.previewBudget.saturationOversample;`,
  "saturation oversampling budget",
);

app = replaceExact(
  app,
  `        const length = Math.floor(this.context.sampleRate * 2.2);\n        const impulse = this.context.createBuffer(2, length, this.context.sampleRate);`,
  `        const length = Math.floor(this.context.sampleRate * this.previewBudget.reverbSeconds);\n        const impulse = this.context.createBuffer(this.previewBudget.reverbChannels, length, this.context.sampleRate);`,
  "reverb convolution budget",
);

app = replaceExact(
  app,
  `        this.reverbReturn.gain.value = 0.26;`,
  `        this.reverbReturn.gain.value = 0.26 * this.previewBudget.reverbReturnScale;`,
  "reverb return budget",
);

app = replaceExact(
  app,
  `        feedback.gain.value = 0.18;`,
  `        feedback.gain.value = this.previewBudget.delayFeedback;`,
  "delay feedback budget",
);

app = replaceExact(
  app,
  `        this.delayReturn.gain.value = 0.12;`,
  `        this.delayReturn.gain.value = 0.12 * this.previewBudget.delayReturnScale;`,
  "delay return budget",
);

app = replaceExact(
  app,
  `    settle(this.reverbReturn?.gain, profile.reverbReturn);\n    settle(this.delayReturn?.gain, profile.delayReturn);`,
  `    settle(this.reverbReturn?.gain, profile.reverbReturn * this.previewBudget.reverbReturnScale);\n    settle(this.delayReturn?.gain, profile.delayReturn * this.previewBudget.delayReturnScale);`,
  "song fx constrained returns",
);

app = replaceExact(
  app,
  `        this.master.gain.exponentialRampToValueAtTime(0.42, now + 0.015);`,
  `        this.master.gain.exponentialRampToValueAtTime(0.42, now + this.previewBudget.masterFadeSeconds);`,
  "master fade-in",
);

app = replaceExact(
  app,
  `    if (voice.filterMotionDepth > 0 && duration >= 0.35) {`,
  `    if (this.previewBudget.filterMotion && voice.filterMotionDepth > 0 && duration >= 0.35) {`,
  "filter motion shedding",
);

app = replaceExact(
  app,
  `      const click = context.createOscillator();\n      const clickFilter = context.createBiquadFilter();\n      const clickGain = context.createGain();\n      sources.push(click);\n      nodes.add(click);\n      nodes.add(clickFilter);\n      nodes.add(clickGain);\n      click.type = "triangle";\n      click.frequency.setValueAtTime(character.clickPitch, when);\n      click.frequency.exponentialRampToValueAtTime(Math.max(520, character.clickPitch * 0.28), when + 0.018);\n      clickFilter.type = "highpass";\n      clickFilter.frequency.value = Math.max(700, character.clickPitch * 0.28);\n      this.shapeDrumGain(clickGain.gain, character, character.clickLevel * mixGain, 0.026, when);\n      click.connect(clickFilter).connect(clickGain).connect(output);\n      click.start(when);\n      click.stop(when + 0.03);`,
  `      if (this.previewBudget.preserveKickClick) {\n        const click = context.createOscillator();\n        const clickFilter = context.createBiquadFilter();\n        const clickGain = context.createGain();\n        sources.push(click);\n        nodes.add(click);\n        nodes.add(clickFilter);\n        nodes.add(clickGain);\n        click.type = "triangle";\n        click.frequency.setValueAtTime(character.clickPitch, when);\n        click.frequency.exponentialRampToValueAtTime(Math.max(520, character.clickPitch * 0.28), when + 0.018);\n        clickFilter.type = "highpass";\n        clickFilter.frequency.value = Math.max(700, character.clickPitch * 0.28);\n        this.shapeDrumGain(clickGain.gain, character, character.clickLevel * mixGain, 0.026, when);\n        click.connect(clickFilter).connect(clickGain).connect(output);\n        click.start(when);\n        click.stop(when + 0.03);\n      }`,
  "kick click shedding",
);

app = replaceExact(
  app,
  `      if (character.kind === "snare" || character.kind === "clap") {`,
  `      if (this.previewBudget.preserveSnareSnap && (character.kind === "snare" || character.kind === "clap")) {`,
  "snare snap shedding",
);

app = replaceExact(
  app,
  `    if (this.reverbBus && Number(event.reverb) > 0) {\n      const send = this.context.createGain();\n      send.gain.value = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);\n      output.connect(send).connect(this.reverbBus);\n      trackedNodes?.add(send);\n    }`,
  `    const reverbAmount = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);\n    if (this.reverbBus && reverbAmount > this.previewBudget.sendFloor) {\n      const send = this.context.createGain();\n      send.gain.value = reverbAmount;\n      output.connect(send).connect(this.reverbBus);\n      trackedNodes?.add(send);\n    }`,
  "low-value reverb send cleanup",
);

app = replaceExact(
  app,
  `    if (this.delayBus && delayAmount > 0) {`,
  `    if (this.delayBus && delayAmount > this.previewBudget.sendFloor) {`,
  "low-value delay send cleanup",
);

app = replaceExact(
  app,
  `    this.clearTimers();\n    this.clearScheduledAudio();\n    this.resetDynamicBuses();\n    if (this.context && this.master?.gain) {\n      try {\n        const now = this.context.currentTime;\n        this.master.gain.cancelScheduledValues(now);\n        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);\n        this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);\n      } catch { /* ignore */ }\n    }\n    if (this.context) this.suspendWhenIdle();`,
  `    this.clearTimers();\n    if (this.context && this.master?.gain) {\n      try {\n        const now = this.context.currentTime;\n        this.master.gain.cancelScheduledValues(now);\n        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);\n        this.master.gain.exponentialRampToValueAtTime(0.0001, now + this.previewBudget.masterFadeSeconds);\n      } catch { /* ignore */ }\n    }\n    this.clearScheduledAudio();\n    this.resetDynamicBuses();\n    if (this.context) this.suspendWhenIdle();`,
  "master-first click-safe pause",
);

audio = replaceExact(
  audio,
  `export const PREVIEW_TRANSITION = Object.freeze({\n  startSeconds: 0.004,\n  stopSeconds: 0.016,\n  sourceTailSeconds: 0.006,\n});`,
  `export const PREVIEW_TRANSITION = Object.freeze({\n  startSeconds: 0.005,\n  stopSeconds: 0.024,\n  sourceTailSeconds: 0.01,\n});`,
  "longer click-safe transitions",
);

fs.writeFileSync("src/app.js", app);
fs.writeFileSync("src/core/preview-audio.js", audio);
console.log("Applied constrained Android audio graph cleanup and click-safe transitions.");
