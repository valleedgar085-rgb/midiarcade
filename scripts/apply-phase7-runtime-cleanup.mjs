import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Phase 7 patch missing target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Phase 7 patch target is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`))];
  if (matches.length !== 1) throw new Error(`Phase 7 regex target ${label} matched ${matches.length} times`);
  return source.replace(regex, replacement);
}

let app = fs.readFileSync("src/app.js", "utf8");

app = replaceOnce(
  app,
  'import { previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";',
  'import { previewGraphBudget, previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";',
  "preview performance import",
);

app = replaceOnce(
  app,
  `    this.previewRuntime = previewRuntimeProfile({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      hardwareConcurrency: typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency,
      deviceMemory: typeof navigator === "undefined" ? 8 : navigator.deviceMemory,
    });`,
  `    this.previewRuntime = previewRuntimeProfile({
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      hardwareConcurrency: typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency,
      deviceMemory: typeof navigator === "undefined" ? 8 : navigator.deviceMemory,
    });
    this.previewBudget = previewGraphBudget(this.previewRuntime);`,
  "preview graph budget initialization",
);

app = replaceOnce(
  app,
  `          this.visibilityHandler = () => {
            if (document.visibilityState === "visible" && this.playing && this.context?.state === "suspended") {
              void this.recoverAudioContext(this.context);
            }
          };`,
  `          this.visibilityHandler = () => {
            if (document.visibilityState === "hidden" && this.playing && this.context?.state === "running") {
              this.position = this.currentSongTime();
              this.offset = this.position;
              this.startedAt = this.context.currentTime;
              this.clearTimers();
              this.clearScheduledAudio();
              void this.context.suspend().catch(() => {});
              return;
            }
            if (document.visibilityState === "visible" && this.playing && ["suspended", "interrupted"].includes(this.context?.state)) {
              void this.recoverAudioContext(this.context);
            }
          };`,
  "visibility lifecycle suspension",
);

app = replaceOnce(
  app,
  '      if (typeof this.context.createWaveShaper === "function") {',
  '      if (this.previewBudget.saturation && typeof this.context.createWaveShaper === "function") {',
  "constrained saturation bypass",
);
app = replaceOnce(app, '        saturation.oversample = "4x";', '        saturation.oversample = this.previewBudget.oversample;', "runtime oversampling");
app = replaceOnce(app, '        const length = Math.floor(this.context.sampleRate * 2.2);', '        const length = Math.floor(this.context.sampleRate * this.previewBudget.reverbSeconds);', "runtime reverb length");
app = replaceOnce(app, '        const impulse = this.context.createBuffer(2, length, this.context.sampleRate);', '        const impulse = this.context.createBuffer(this.previewBudget.reverbChannels, length, this.context.sampleRate);', "runtime reverb channels");
app = replaceOnce(app, '        this.reverbReturn.gain.value = 0.26;', '        this.reverbReturn.gain.value = 0.26 * this.previewBudget.reverbReturnScale;', "runtime reverb return");
app = replaceOnce(app, '        feedback.gain.value = 0.18;', '        feedback.gain.value = this.previewBudget.delayFeedback;', "runtime delay feedback");
app = replaceOnce(app, '        this.delayReturn.gain.value = 0.12;', '        this.delayReturn.gain.value = 0.12 * this.previewBudget.delayReturnScale;', "runtime delay return");

app = replaceOnce(
  app,
  `    settle(this.reverbReturn?.gain, profile.reverbReturn);
    settle(this.delayReturn?.gain, profile.delayReturn);`,
  `    settle(this.reverbReturn?.gain, profile.reverbReturn * this.previewBudget.reverbReturnScale);
    settle(this.delayReturn?.gain, profile.delayReturn * this.previewBudget.delayReturnScale);`,
  "song FX budget scaling",
);

app = replaceOnce(
  app,
  '        this.master.gain.exponentialRampToValueAtTime(0.42, now + 0.015);',
  '        this.master.gain.exponentialRampToValueAtTime(0.42, now + this.previewBudget.masterFadeSeconds);',
  "master start ramp",
);
app = replaceOnce(
  app,
  '    if (voice.filterMotionDepth > 0 && duration >= 0.35) {',
  '    if (this.previewBudget.filterMotion && voice.filterMotionDepth > 0 && duration >= 0.35) {',
  "constrained filter motion",
);

app = replaceOnce(
  app,
  `    if (this.reverbBus && Number(event.reverb) > 0) {
      const send = this.context.createGain();
      send.gain.value = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);
      output.connect(send).connect(this.reverbBus);
      trackedNodes?.add(send);
    }`,
  `    const reverbSend = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);
    if (this.reverbBus && reverbSend > this.previewBudget.sendFloor) {
      const send = this.context.createGain();
      send.gain.value = reverbSend;
      output.connect(send).connect(this.reverbBus);
      trackedNodes?.add(send);
    }`,
  "reverb send floor",
);

app = replaceOnce(
  app,
  `    if (this.delayBus && delayAmount > 0) {
      const delaySend = this.context.createGain();
      delaySend.gain.value = delayAmount * clamp(0.35 + Number(event.reverb || 0), 0.35, 1.15);
      output.connect(delaySend).connect(this.delayBus);
      trackedNodes?.add(delaySend);
    }`,
  `    const delaySendAmount = delayAmount * clamp(0.35 + Number(event.reverb || 0), 0.35, 1.15);
    if (this.delayBus && delaySendAmount > this.previewBudget.sendFloor) {
      const delaySend = this.context.createGain();
      delaySend.gain.value = delaySendAmount;
      output.connect(delaySend).connect(this.delayBus);
      trackedNodes?.add(delaySend);
    }`,
  "delay send floor",
);

app = replaceRegexOnce(
  app,
  /      const click = context\.createOscillator\(\);[\s\S]*?      click\.stop\(when \+ 0\.03\);/,
  (block) => `      if (this.previewBudget.preserveKickClick) {\n${block.split("\n").map((line) => `  ${line}`).join("\n")}\n      }`,
  "kick click layer",
);
app = replaceOnce(
  app,
  '      if (character.kind === "snare" || character.kind === "clap") {',
  '      if (this.previewBudget.preserveSnareSnap && (character.kind === "snare" || character.kind === "clap")) {',
  "snare snap layer",
);
app = replaceOnce(
  app,
  '        this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);',
  '        this.master.gain.exponentialRampToValueAtTime(0.0001, now + this.previewBudget.masterFadeSeconds);',
  "master stop ramp",
);

fs.writeFileSync("src/app.js", app);

let smoke = fs.readFileSync("tests/app-smoke.test.mjs", "utf8");
smoke = replaceOnce(
  smoke,
  '  assert.match(appSource, /createWaveShaper/, "preview audio must include oversampled saturation");\n  assert.match(appSource, /oversample = "4x"/, "preview saturation must use high-quality oversampling");',
  '  assert.match(appSource, /createWaveShaper/, "full preview audio must retain the saturation stage");\n  assert.match(appSource, /previewGraphBudget/, "preview audio must resolve a runtime DSP budget");\n  assert.match(appSource, /this\\.previewBudget\\.saturation/, "constrained playback must be able to bypass saturation");\n  assert.match(appSource, /saturation\\.oversample = this\\.previewBudget\\.oversample/, "oversampling must follow the runtime graph budget");',
  "app smoke DSP assertions",
);
smoke = replaceOnce(
  smoke,
  `  assert.deepEqual(fxCalls, [
    [clubMix.delaySeconds, 3, 0.025],
    [clubMix.reverbReturn, 3, 0.025],
    [clubMix.delayReturn, 3, 0.025],
  ]);`,
  `  assert.deepEqual(fxCalls, [
    [clubMix.delaySeconds, 3, 0.025],
    [clubMix.reverbReturn * fxPlayer.previewBudget.reverbReturnScale, 3, 0.025],
    [clubMix.delayReturn * fxPlayer.previewBudget.delayReturnScale, 3, 0.025],
  ], "song FX returns must respect the active runtime DSP budget");`,
  "runtime-aware FX smoke expectation",
);
fs.writeFileSync("tests/app-smoke.test.mjs", smoke);

console.log("Phase 7 runtime audio integration applied.");
