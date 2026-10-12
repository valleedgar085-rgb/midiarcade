/**
 * Phase 4.2 sample instrument transport. Only explicitly bundled, licensed
 * samples should be registered. Missing assets always retain synth playback.
 */
export const PITCHED_SAMPLE_MANIFEST = Object.freeze({
  bass: Object.freeze([]),
  chords: Object.freeze([
    { path: "./assets/audio/instruments/piano/piano-48.wav", rootPitch: 48, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-48-strong.wav", rootPitch: 48, velocityLayer: 2 },
    { path: "./assets/audio/instruments/piano/piano-53.wav", rootPitch: 53, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-53-strong.wav", rootPitch: 53, velocityLayer: 2 },
    { path: "./assets/audio/instruments/piano/piano-60.wav", rootPitch: 60, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-60-strong.wav", rootPitch: 60, velocityLayer: 2 },
    { path: "./assets/audio/instruments/piano/piano-65.wav", rootPitch: 65, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-65-strong.wav", rootPitch: 65, velocityLayer: 2 },
    { path: "./assets/audio/instruments/piano/piano-72.wav", rootPitch: 72, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-72-strong.wav", rootPitch: 72, velocityLayer: 2 },
    { path: "./assets/audio/instruments/piano/piano-77.wav", rootPitch: 77, velocityLayer: 1 },
    { path: "./assets/audio/instruments/piano/piano-77-strong.wav", rootPitch: 77, velocityLayer: 2 },
  ]),
});

export function selectPitchedSample(trackId, pitch, manifest = PITCHED_SAMPLE_MANIFEST, velocity = 90) {
  const entries = manifest?.[trackId];
  if (!Array.isArray(entries) || !entries.length || !Number.isFinite(Number(pitch))) return null;
  const target = Math.max(0, Math.min(127, Math.round(Number(pitch))));
  // The original piano mapping uses vl1 for MIDI velocities 1–63 and
  // vl2 for 64–127. Select timbre after matching the note zone.
  const desiredLayer = Number.isFinite(Number(velocity)) && Number(velocity) < 64 ? 1 : 2;
  const ranked = entries.filter((entry) =>
    entry && typeof entry.path === "string" && entry.path.startsWith("./assets/audio/instruments/")
    && Number.isInteger(entry.rootPitch) && entry.rootPitch >= 0 && entry.rootPitch <= 127
    && Math.abs(entry.rootPitch - target) <= 7);
  ranked.sort((a, b) => Math.abs(a.rootPitch - target) - Math.abs(b.rootPitch - target)
    || Math.abs((a.velocityLayer ?? 1) - desiredLayer) - Math.abs((b.velocityLayer ?? 1) - desiredLayer)
    || a.rootPitch - b.rootPitch);
  return ranked[0] ?? null;
}

export async function preloadPitchedSamples(context, manifest = PITCHED_SAMPLE_MANIFEST, cache = new Map(), fetcher = globalThis.fetch) {
  if (!context?.decodeAudioData || typeof fetcher !== "function") return cache;
  const entries = [...new Set(Object.values(manifest).flat().map((entry) => entry?.path).filter(
    (path) => typeof path === "string" && path.startsWith("./assets/audio/instruments/"),
  ))];
  await Promise.all(entries.map(async (path) => {
    if (cache.has(path)) return;
    try {
      const response = await fetcher(path);
      if (!response || ("ok" in response && !response.ok)) throw Error("sample-fetch-failed");
      const bytes = await response.arrayBuffer();
      cache.set(path, await context.decodeAudioData(bytes.slice(0)));
    } catch {
      cache.set(path, null);
    }
  }));
  return cache;
}

// Match the perceived level of short piano recordings without pushing the
// master bus harder. AudioBuffer analysis is cached: notes never rescan audio.
const sampleLevelCache = new WeakMap();

export function pitchedSampleLevelCompensation(buffer) {
  if (!buffer || typeof buffer.getChannelData !== "function") return 1;
  const previous = sampleLevelCache.get(buffer);
  if (previous !== undefined) return previous;
  let compensation = 1;
  try {
    const samples = buffer.getChannelData(0);
    const sampleRate = Number(buffer.sampleRate) || 22050;
    const sampleCount = Math.min(samples.length, Math.floor(sampleRate * 0.8));
    let squareSum = 0;
    let peak = 0;
    let analyzed = 0;
    for (let i = 0; i < sampleCount; i += 8) {
      const amplitude = Math.abs(samples[i]);
      if (!Number.isFinite(amplitude)) continue;
      peak = Math.max(peak, amplitude);
      squareSum += amplitude * amplitude;
      analyzed += 1;
    }
    if (analyzed > 0 && peak > 0.0001) {
      const rms = Math.sqrt(squareSum / analyzed);
      // Capped boost for quiet recordings, backed off for loud transients.
      // A safety ceiling prevents a single piano key from clipping its voice.
      compensation = Math.max(0.2, Math.min(1.8, 0.11 / Math.max(rms, 0.0001), 0.7 / peak));
    }
  } catch {
    compensation = 1;
  }
  sampleLevelCache.set(buffer, compensation);
  return compensation;
}

export function schedulePitchedSample(context, buffer, event, rootPitch, when, destination, nodes) {
  if (!context?.createBufferSource || !context?.createGain || !buffer || !destination) return null;
  const pitch = Number(event?.pitch);
  if (!Number.isFinite(pitch) || !Number.isInteger(rootPitch)) return null;
  const rate = 2 ** ((pitch - rootPitch) / 12);
  if (rate < 0.66 || rate > 1.5) return null;
  const source = context.createBufferSource();
  const gain = context.createGain();
  const duration = Math.max(0.04, Math.min(6, Number(event?.duration) || 0.25));
  const tail = 0.09;
  const available = Number(buffer.duration) / rate;
  if (!Number.isFinite(available) || available < 0.06) return null;
  const end = Math.min(duration + tail, available);
  const attack = Math.min(0.012, end * 0.2);
  const release = Math.min(0.09, Math.max(0.018, end * 0.16));
  const peak = Math.max(0.0002, Math.min(0.48,
    (Math.max(1, Math.min(127, Number(event.velocity) || 90)) / 127) * 0.38
    * Math.max(0, Math.min(1, Number(event.mixGain ?? 1)))
    * pitchedSampleLevelCompensation(buffer)));
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(rate, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.setValueAtTime(peak, when + Math.max(attack + 0.001, end - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + end);
  source.connect(gain).connect(destination);
  nodes?.add(source);
  nodes?.add(gain);
  source.start(when);
  source.stop(when + end + 0.005);
  return source;
}
