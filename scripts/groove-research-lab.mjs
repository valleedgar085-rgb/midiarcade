import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ToneMidi from "@tonejs/midi";

const { Midi } = ToneMidi;

import {
  aggregateGroovePerformances,
  extractGroovePerformance,
  GROOVE_FINGERPRINT_VERSION,
} from "../src/core/groove-fingerprint.js";

const SOURCE = Object.freeze({
  name: "Groove MIDI Dataset",
  version: "1.0.0",
  homepage: "https://magenta.tensorflow.org/datasets/groove",
  license: "CC BY 4.0",
  midiOnlySha256: "651cbc524ffb891be1a3e46d89dc82a1cecb09a57c748c7b45b844c4841dcc1e",
});

function argsFrom(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
    args[key] = value;
  }
  return args;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
}

async function loadMetadata(datasetRoot) {
  const infoPath = path.join(datasetRoot, "info.csv");
  const text = await fs.readFile(infoPath, "utf8");
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => Object.fromEntries(
    parseCsvLine(line).map((value, index) => [headers[index], value]),
  ));
}

function primaryStyle(style) {
  return String(style || "unknown").split("/")[0].trim().toLowerCase();
}

function parseTimeSignature(value) {
  const [numerator, denominator] = String(value || "4-4").split("-").map(Number);
  return [numerator || 4, denominator || 4];
}

async function inspectMidi(datasetRoot, row) {
  const bytes = await fs.readFile(path.join(datasetRoot, row.midi_filename));
  const midi = new Midi(bytes);
  const notes = midi.tracks.flatMap((track) => track.notes.map((note) => ({
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks,
    velocity: note.velocity,
  })));
  const totalTicks = notes.reduce((max, note) => Math.max(max, note.ticks + note.durationTicks), 0);
  return extractGroovePerformance({
    notes,
    ppq: midi.header.ppq,
    totalTicks,
    style: primaryStyle(row.style),
    beatType: row.beat_type,
    bpm: Number(row.bpm),
    timeSignature: parseTimeSignature(row.time_signature),
  });
}

const args = argsFrom(process.argv);
const datasetRoot = path.resolve(String(args.dataset || ""));
const outputPath = path.resolve(String(args.output || "gmd-groove-fingerprints.json"));
const maxFiles = args["max-files"] ? Math.max(1, Number(args["max-files"])) : Infinity;

if (!args.dataset) throw new Error("Usage: node scripts/groove-research-lab.mjs --dataset <groove-root> --output <json>");

const rows = (await loadMetadata(datasetRoot))
  .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  .slice(0, maxFiles);

const performances = [];
const failures = [];
for (const row of rows) {
  try {
    performances.push(await inspectMidi(datasetRoot, row));
  } catch (error) {
    failures.push({ id: row.id, midi: row.midi_filename, message: error?.message || String(error) });
  }
}

const profiles = aggregateGroovePerformances(performances);
const styleNames = Object.keys(profiles).sort();
const output = {
  schemaVersion: GROOVE_FINGERPRINT_VERSION,
  generatedBy: "MIDI Arcade Groove MIDI Research Lab",
  source: SOURCE,
  extraction: {
    filesRequested: rows.length,
    filesParsed: performances.length,
    filesFailed: failures.length,
    styles: styleNames.length,
    styleNames,
    failures: failures.slice(0, 20),
  },
  profiles,
};

if (rows.length >= 1000 && performances.length < 1000) {
  throw new Error(`Expected at least 1000 parsed performances from full GMD; got ${performances.length}.`);
}
if (rows.length >= 1000 && styleNames.length < 15) {
  throw new Error(`Expected broad GMD style coverage; got only ${styleNames.length} styles.`);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(JSON.stringify({
  schemaVersion: output.schemaVersion,
  source: output.source.name,
  filesParsed: output.extraction.filesParsed,
  filesFailed: output.extraction.filesFailed,
  styles: output.extraction.styleNames,
  output: outputPath,
}, null, 2));
