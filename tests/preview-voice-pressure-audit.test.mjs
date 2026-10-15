import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("Android voice-pressure audit emits finite diagnostic values and never edits notes", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "midi-audio-pressure-"));
  try {
    const output = path.join(temp,"report.json");
    const script = fileURLToPath(new URL("../scripts/audit-preview-pressure-generation.mjs", import.meta.url));
    const stdout=execFileSync(process.execPath,[
      script,"--genres","hipHop","--seeds","1","--bars","8","--json",output,
    ],{encoding:"utf8",timeout:90000});
    assert.match(stdout,/PREVIEW_PRESSURE_SUMMARY/);
    const report=JSON.parse(fs.readFileSync(output,"utf8"));
    assert.equal(report.mode,"read-only");
    assert.equal(report.rows.length,1);
    const row=report.rows[0];
    assert.equal(row.pressure.maxVoices,32);
    assert.ok(row.generationMs>=0 && Number.isFinite(row.generationMs));
    assert.ok(row.pressure.notes>0);
    assert.ok(row.pressure.estimatedScheduledOccupancy.peak>=row.pressure.estimatedAudibleOverlap.peak);
    assert.ok(report.summary.p50Ms>=0);
    assert.match(report.limits.join(" "),/NOT proof of an audible click/);
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
