import { clamp } from "../utils.js";

const TOM_PITCHES = new Set([41, 43, 45, 47, 48, 50]);
const HAT_PITCHES = new Set([42, 44, 46]);
const CYMBAL_PITCHES = new Set([49, 51, 52, 55, 57, 59]);

const BUNDLED_DRUM_SAMPLES = Object.freeze({
  "basement-knock": Object.freeze({
    kick: "./assets/audio/drums/cc0-bounce/kick.wav",
    snare: "./assets/audio/drums/cc0-bounce/snare.wav",
    clap: "./assets/audio/drums/cc0-bounce/clap.wav",
    hat: "./assets/audio/drums/cc0-bounce/hat.wav",
    "open-hat": "./assets/audio/drums/cc0-bounce/open-hat.wav",
  }),
  "dusty-tape": Object.freeze({
    kick: "./assets/audio/drums/cc0-soulful-vintage/kick.wav",
    snare: "./assets/audio/drums/cc0-soulful-vintage/snare.wav",
    clap: "./assets/audio/drums/cc0-soulful-vintage/clap.wav",
    hat: "./assets/audio/drums/cc0-soulful-vintage/hat.wav",
    "open-hat": "./assets/audio/drums/cc0-soulful-vintage/open-hat.wav",
  }),
});

function drumKind(pitch) {
  if (pitch === 35 || pitch === 36) return "kick";
  if (TOM_PITCHES.has(pitch)) return "tom";
  if (pitch === 46) return "open-hat";
  if (HAT_PITCHES.has(pitch)) return "hat";
  if (CYMBAL_PITCHES.has(pitch)) return "cymbal";
  if (pitch === 37) return "rim";
  if (pitch === 39) return "clap";
  return "snare";
}

export function bundledDrumSamplePath(kitId, pitch) {
  return BUNDLED_DRUM_SAMPLES[String(kitId)]?.[drumKind(pitch)] ?? null;
}

export async function preloadDrumSampleKit(context, kitId, cache = new Map(), fetcher = globalThis.fetch) {
  const files = BUNDLED_DRUM_SAMPLES[String(kitId)];
  if (!context?.decodeAudioData || !files || typeof fetcher !== "function") return cache;
  await Promise.all(Object.entries(files).map(async ([kind, path]) => {
    const key = `${kitId}:${kind}`;
    if (cache.has(key)) return;
    try {
      const response = await fetcher(path);
      if (!response || ("ok" in response && !response.ok)) throw new Error("sample-fetch-failed");
      const bytes = await response.arrayBuffer();
      cache.set(key, await context.decodeAudioData(bytes.slice(0)));
    } catch {
      cache.set(key, null);
    }
  }));
  return cache;
}

export function drumSampleForPitch(cache, kitId, pitch) {
  return cache?.get(`${kitId}:${drumKind(pitch)}`) ?? null;
}

export function drumSampleEnvelope(character, bufferDuration) {
  const kind = String(character?.kind ?? "snare");
  const sourceDuration = Math.max(0.018, Number(bufferDuration) || 0.08);
  const naturalDuration = kind === "kick"
    ? Number(character?.kickDecay ?? character?.duration ?? 0.2)
    : Number(character?.duration ?? 0.12);
  const limits = kind === "kick"
    ? { min: 0.14, max: 0.46, scale: 1.08, release: 0.55 }
    : kind === "open-hat"
      ? { min: 0.11, max: 0.36, scale: 1.05, release: 0.3 }
      : kind === "hat"
        ? { min: 0.028, max: 0.085, scale: 1.02, release: 0.2 }
        : ["snare", "clap"].includes(kind)
          ? { min: 0.085, max: 0.3, scale: 1.08, release: 0.34 }
          : { min: 0.06, max: 0.32, scale: 1.05, release: 0.35 };
  const duration = Math.min(
    sourceDuration,
    clamp(naturalDuration * limits.scale, limits.min, limits.max),
  );
  const attack = Math.min(0.002, duration * 0.08);
  const releaseStart = clamp(duration * limits.release, attack, Math.max(attack, duration - 0.006));
  return Object.freeze({ duration, attack, releaseStart });
}

export function scheduleDrumSampleVoice(context, buffer, character, mixGain, when, destination, nodes) {
  if (!context?.createBufferSource || !buffer || !destination) return null;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const kind = String(character?.kind ?? "snare");
  const envelope = drumSampleEnvelope(character, buffer.duration);
  const duration = envelope.duration;
  const level = kind === "kick" ? 0.42 : ["snare", "clap"].includes(kind) ? 0.34 : 0.22;
  const peak = Math.max(0.0002, Number(character?.amplitude ?? 1) * Number(mixGain ?? 1) * level);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + envelope.attack);
  gain.gain.setValueAtTime(peak, when + envelope.releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.buffer = buffer;
  source.connect(gain).connect(destination);
  nodes?.add(source);
  nodes?.add(gain);
  source.start(when);
  source.stop(when + duration + 0.005);
  return source;
}

function signedVariation(pitch, variationSeed) {
  let value = (Math.trunc(Number(variationSeed) * 1000) ^ (pitch * 2654435761)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822507) >>> 0;
  return ((value % 2001) / 1000) - 1;
}

/**
 * Derive a bounded preview character from a one-shot kit and MIDI velocity.
 * This stays pure so Web Audio scheduling remains deterministic and testable.
 */
export function previewDrumCharacter(preview, pitch, velocity, variationSeed = 0) {
  const kind = drumKind(pitch);
  const velocityNorm = clamp(Number(velocity) / 127, 0, 1);
  const amplitude = velocityNorm ** 0.82;
  const brightness = 0.76 + (velocityNorm * 0.32);
  const variation = signedVariation(pitch, variationSeed);
  const decayScale = clamp(0.82 + (velocityNorm * 0.24) + (variation * 0.035), 0.78, 1.1);
  const baseFilter = kind === "cymbal"
    ? preview.cymbalFilter
    : kind === "hat" || kind === "open-hat"
      ? preview.hatFilter
      : kind === "rim"
        ? preview.snareFilter * 1.35
        : preview.snareFilter;
  const baseDuration = kind === "cymbal"
    ? preview.cymbalDecay
    : kind === "open-hat"
      ? preview.openHatDecay
      : kind === "hat"
        ? preview.hatDecay
        : kind === "rim"
          ? Math.min(0.09, preview.snareDecay * 0.48)
          : preview.snareDecay;
  const basePeak = kind === "cymbal" ? 0.16 : kind === "hat" || kind === "open-hat" ? 0.12 : kind === "rim" ? 0.14 : 0.22;
  const panWidth = kind === "cymbal" ? 0.17 : kind === "hat" || kind === "open-hat" ? 0.11 : kind === "tom" ? 0.08 : 0.025;

  return Object.freeze({
    kind,
    velocityNorm,
    amplitude,
    filterFrequency: clamp(baseFilter * brightness * (1 + variation * 0.025), 600, 11800),
    duration: clamp(baseDuration * decayScale, 0.018, 0.9),
    peak: amplitude * basePeak,
    panOffset: clamp(variation * panWidth, -0.18, 0.18),
    kickStart: preview.kickStart * (0.9 + velocityNorm * 0.16),
    kickEnd: preview.kickEnd * (0.97 + velocityNorm * 0.05),
    kickDecay: clamp(preview.kickDecay * (0.88 + velocityNorm * 0.18), 0.12, 0.42),
    clickPitch: clamp(preview.clickPitch * brightness, 900, 11800),
    clickLevel: preview.clickLevel * amplitude * (0.62 + velocityNorm * 0.38),
    bodyLevel: amplitude * (0.035 + velocityNorm * 0.025),
    toneLevel: amplitude * (0.065 + velocityNorm * 0.045),
    snapLevel: amplitude * (kind === "clap" ? 0.09 : 0.065),
    snapFrequency: clamp(preview.snareFilter * (1.85 + velocityNorm * 0.55), 2200, 9200),
    snapDecay: clamp(preview.snareDecay * (kind === "clap" ? 0.42 : 0.3), 0.032, 0.09),
  });
}

/** Return positive, ordered gain points so drum transients never begin with a click. */
export function previewDrumEnvelope(
  character,
  peakValue = character?.peak,
  durationValue = character?.duration,
  preserveClapBursts = true,
) {
  const peak = Math.max(0.0001, Number(peakValue) || 0);
  const duration = clamp(Number(durationValue) || 0.08, 0.018, 0.9);
  const attack = Math.min(0.0025, duration * 0.12);
  if (character?.kind === "clap" && preserveClapBursts) {
    return Object.freeze([
      { offset: 0, value: 0.0001 },
      { offset: attack, value: peak },
      { offset: 0.012, value: 0.0001 },
      { offset: 0.019, value: peak * 0.72 },
      { offset: 0.031, value: 0.0001 },
      { offset: 0.039, value: peak * 0.48 },
      { offset: duration, value: 0.0001 },
    ]);
  }
  return Object.freeze([
    { offset: 0, value: 0.0001 },
    { offset: attack, value: peak },
    { offset: duration, value: 0.0001 },
  ]);
}
