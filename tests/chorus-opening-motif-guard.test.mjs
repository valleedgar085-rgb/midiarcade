import test from "node:test";
import assert from "node:assert/strict";
import { generateNew, normalizeConfig } from "../src/music-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";

const config={genre:"neoSoul",seed:"hook-return-first-two-bars-v1",key:"E",scale:"minor",
  bars:32,energy:0.68,complexity:0.62,variation:0.62,evolution:0.68,
  swing:0.14,humanize:0.12,candidateCount:1};
const trace=song=>song.tracks.map(track=>[track.id,(track.notes??[]).map(n=>[n.start,n.pitch,n.duration,n.velocity])]);

test("opt-in motif opening guard is explicitly absent from baseline, short songs and fusions",()=>{
  assert.equal(normalizeConfig(config).hookReturnOpeningGuardV1,undefined);
  assert.equal(normalizeConfig({...config,hookReturnOpeningGuardV1:false}).hookReturnOpeningGuardV1,undefined);
  assert.equal(normalizeConfig({...config,hookReturnOpeningGuardV1:true}).hookReturnOpeningGuardV1,true);
  assert.equal(normalizeConfig({...config,bars:8,hookReturnOpeningGuardV1:true}).hookReturnOpeningGuardV1,undefined);
  assert.equal(normalizeConfig({...config,secondaryGenre:"pop",hookReturnOpeningGuardV1:true}).hookReturnOpeningGuardV1,undefined);
  assert.equal(normalizeConfig({...config,genre:"jazz",hookReturnOpeningGuardV1:true}).hookReturnOpeningGuardV1,undefined);
});

test("off/default preserve identical seeded song events and score",()=>{
  const baseline=generateNew(config);
  const off=generateNew({...config,hookReturnOpeningGuardV1:false});
  assert.deepEqual(trace(off),trace(baseline));
  assert.deepEqual(evaluateChorusHookRecurrence(off),evaluateChorusHookRecurrence(baseline));
});

test("opt-in song generation is deterministic, retains arrangements, and leaves original config unchanged",()=>{
  const before=structuredClone(config);
  const on=generateNew({...config,hookReturnOpeningGuardV1:true});
  const repeat=generateNew({...config,hookReturnOpeningGuardV1:true});
  const off=generateNew(config);
  assert.deepEqual(trace(on),trace(repeat));
  assert.deepEqual(on.structure,off.structure);
  assert.equal(on.meta?.genre,off.meta?.genre);
  assert.equal(on.meta?.keyPc,off.meta?.keyPc);
  assert.deepEqual(config,before);
  const hook=evaluateChorusHookRecurrence(on);
  assert.ok(["evaluated","incomplete","unavailable"].includes(hook.status));
  for(const track of on.tracks)for(const note of track.notes??[]){
    assert.ok(Number.isFinite(note.pitch)&&note.pitch>=0&&note.pitch<=127);
    assert.ok(Number.isFinite(note.start)&&Number.isFinite(note.duration));
  }
});
