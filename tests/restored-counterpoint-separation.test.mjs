import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";

const engineUrl = new URL("../src/music-engine.js", import.meta.url);

function overlapsLeadGap(counterNote, melodyNotes) {
  return melodyNotes.some((lead) => (
    Math.abs(lead.start - counterNote.start) < 0.16
    || (
      counterNote.start > lead.start - 0.04
      && counterNote.start < lead.start + lead.duration + 0.08
    )
  ));
}

test("synthesized restored counterpoint anchors route through the existing interlace gap planner", async () => {
  const engine = await readFile(engineUrl, "utf8");
  const start = engine.indexOf("function runCandidateAssemblyRepair(");
  const end = engine.indexOf("function runFinalAssemblyPass(", start);
  assert.ok(start >= 0 && end > start, "runCandidateAssemblyRepair must remain defined");
  const repair = engine.slice(start, end);

  const synthMarker = repair.indexOf("synthesizedCounterpointAnchor = true");
  const plannerCall = repair.indexOf("const plannedAnswer = interlaceCounterpoint(");
  const push = repair.indexOf("track.notes.push({");
  assert.ok(synthMarker >= 0, "counterpoint fallback synthesis must be explicitly marked");
  assert.ok(plannerCall > synthMarker, "synthesized counterpoint must be planned after synthesis");
  assert.ok(plannerCall < push, "gap planning must happen before the restored note is committed");
  assert.match(repair, /\[anchor\],\s*melodyTrack\?\.notes \?\? \[\],\s*config,\s*\[section\],\s*\[\],/s);
});

test("R&B deterministic generation keeps restored counterpoint answers out of lead attacks", () => {
  const config = {
    genre: "rnbSoul",
    seed: "quality-lab-03:rnbSoul",
    bars: 16,
    candidateCount: 1,
    maxCandidateCount: 1,
    adaptive: false,
  };
  const first = generateNew(config);
  const second = generateNew(config);

  assert.deepEqual(first, second, "the repair must preserve deterministic generation");
  assert.ok(first.finalAssembly && Object.values(first.finalAssembly.checks ?? {}).every(Boolean));
  assert.equal(first.meta?.scoreDetails?.releaseGate?.passed, true);

  const melody = first.tracks.find((track) => track.id === "melody")?.notes ?? [];
  const restoredCounterpoint = (first.tracks.find((track) => track.id === "counterpoint")?.notes ?? [])
    .filter((note) => note.finalAssemblyRole === "restored-feature-anchor");

  for (const note of restoredCounterpoint) {
    assert.equal(
      overlapsLeadGap(note, melody),
      false,
      `restored counterpoint at beat ${note.start} must occupy a real lead gap`,
    );
  }
});
