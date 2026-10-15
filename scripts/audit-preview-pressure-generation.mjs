/**
 * Read-only diagnostic: CPU time per fixed-seed generation and an *estimated*
 * voice occupancy envelope. Does not render Web Audio or alter note events.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { generateNew, GENRE_PROFILES } from "../src/music-engine.js";
import { previewRuntimeProfile } from "../src/core/preview-performance.js";
import { previewNoteEnvelope } from "../src/core/preview-audio.js";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
const int = (input, name, max) => {
  const n = Number(input);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error(name + " must be in range 1.." + max);
  return n;
};
const seedCount = int(option("--seeds", "2"), "seeds", 5);
const bars = int(option("--bars", "32"), "bars", 128);
const genres = option("--genres", Object.keys(GENRE_PROFILES).join(","))
  .split(",").map(g => g.trim()).filter(Boolean);
if (!genres.length || genres.some(g => !(g in GENRE_PROFILES))) throw Error("unknown genre");
const jsonOut = option("--json", null);
const android = previewRuntimeProfile({ userAgent: "Android 16; WebView", hardwareConcurrency: 8, deviceMemory: 8 });
const round = (v, p = 3) => Number(v.toFixed(p));

/**
 * Sweep event intervals. A schedule-pressure estimate includes pre-start
 * lookahead; an audible-overlap estimate does not. Notes are approximated as
 * individual sources, not graph-layer multipliers, and must never be treated
 * as measured WebAudio nodes or actual processor load.
 */
export function estimateVoicePressure(song, { maxVoices = 32, lookAheadSeconds = 0.55 } = {}) {
  const tempo = Math.max(40, Math.min(250, Number(song?.meta?.tempo ?? song?.bpm ?? 120) || 120));
  const beatSeconds = 60 / tempo;
  const events = { simultaneous: [], scheduled: [] };
  const byTrack = {};
  let notes = 0;
  for (const track of song?.tracks ?? []) {
    const id = String(track?.id ?? "");
    byTrack[id] = (track.notes ?? []).length;
    for (const note of track.notes ?? []) {
      const startBeat = Number(note?.start);
      const durationBeats = Number(note?.duration);
      if (!Number.isFinite(startBeat) || !Number.isFinite(durationBeats) || durationBeats <= 0) continue;
      const start = Math.max(0, startBeat * beatSeconds);
      const envelope = id === "drums"
        ? { duration: Math.min(0.38, Math.max(0.04, durationBeats * beatSeconds)), release: 0.06 }
        : previewNoteEnvelope({
          trackId: id, duration: durationBeats * beatSeconds,
          release: 0.14, reverb: 0.2, articulation: note?.articulation,
        });
      const finish = start + envelope.duration + envelope.release;
      // End events sort first when start/end share a timestamp.
      events.simultaneous.push([start, 1], [finish, -1]);
      events.scheduled.push([Math.max(0, start - lookAheadSeconds), 1], [finish, -1]);
      notes++;
    }
  }
  const measure = items => {
    const ordered = items.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let live = 0, peak = 0, exceedingWindows = 0, excessSeconds = 0, from = 0;
    for (const [time, delta] of ordered) {
      if (live > maxVoices && time > from) {
        exceedingWindows++;
        excessSeconds += time - from;
      }
      live += delta;
      peak = Math.max(peak, live);
      from = time;
    }
    return { peak, windowsAboveBudget: exceedingWindows, secondsAboveBudget: round(excessSeconds) };
  };
  return {
    tempo, notes, maxVoices, lookAheadSeconds, byTrack,
    estimatedAudibleOverlap: measure(events.simultaneous),
    estimatedScheduledOccupancy: measure(events.scheduled),
    limitation: "Estimate only: not actual WebAudio voice count, DSP load, click measurement, or playback proof",
  };
}

export function summarizeDurationRows(rows) {
  const values = rows.map(r => r.generationMs).sort((a,b)=>a-b);
  const at = fraction => values.length ? values[Math.min(values.length - 1, Math.floor(fraction*(values.length-1)))] : 0;
  return {
    p50Ms: round(at(0.5)), p90Ms: round(at(0.9)), worstMs: round(at(1)),
    estimatedScheduledOverBudget: rows.filter(r => r.pressure.estimatedScheduledOccupancy.peak > r.pressure.maxVoices).length,
    estimatedAudibleOverBudget: rows.filter(r => r.pressure.estimatedAudibleOverlap.peak > r.pressure.maxVoices).length,
  };
}

const rows = [];
for (const genre of genres) {
  for (let i = 0; i < seedCount; i++) {
    const seed = "preview-pressure-v1-" + genre + "-" + String(i + 1).padStart(2,"0");
    const config = {
      genre, seed, bars, key: "E", scale: "minor",
      energy: 0.68, complexity: 0.62, variation: 0.62,
      evolution: 0.68, swing: 0.14, humanize: 0.12,
    };
    const t0 = performance.now();
    const song = generateNew(config);
    const generationMs = round(performance.now() - t0);
    const before = JSON.stringify((song.tracks ?? []).map(t => [t.id,t.notes]));
    const pressure = estimateVoicePressure(song,{
      maxVoices: android.maxScheduledVoices,
      lookAheadSeconds: android.lookAheadSeconds,
    });
    if (JSON.stringify((song.tracks ?? []).map(t => [t.id,t.notes])) !== before)
      throw Error("Read-only voice census mutated generated MIDI: " + seed);
    const row = { genre,seed,bars,generationMs,pressure };
    rows.push(row);
    console.log("PREVIEW_PRESSURE_CASE",JSON.stringify({
      genre,seed,generationMs,audiblePeak:pressure.estimatedAudibleOverlap.peak,
      scheduledPeak:pressure.estimatedScheduledOccupancy.peak,budget:android.maxScheduledVoices,
    }));
  }
}
const summary = summarizeDurationRows(rows);
const report = {
  version: 1, mode: "read-only", rows, summary,
  environment: {
    node: process.version, platform: process.platform,
    profile: android, note: "CI runner CPU time is not Pixel/Android timing",
  },
  limits: [
    "MIDI notes are only an occupancy proxy; rendered oscillators, sends, and voice teardown are not measured.",
    "A high overlap count is a risk flag, NOT proof of an audible click.",
    "Small p50 time does not imply that worker, postprocessing, database, or Android UI is equally quick.",
    "Measure actual Android audio glitches and note timing on-device before changing envelope or headroom.",
  ],
};
if(jsonOut){
  const file=path.resolve(jsonOut);
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(report,null,2)+"\n");
}
console.log("PREVIEW_PRESSURE_SUMMARY",JSON.stringify({songs:rows.length,genres:genres.length,...summary}));
