import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBassPocket } from "../scripts/lib/bass-head-pocket.mjs";
const song={meta:{bpm:120,beatsPerBar:4},tracks:[{id:"drums",notes:[{pitch:36,start:0},{pitch:38,start:1},{pitch:35,start:2}]},{id:"bass",notes:[{pitch:40,start:0,duration:.4},{pitch:43,start:1.5,duration:.25},{pitch:40,start:2,duration:.5}]}]};
test("kick-only GM 35/36, exact locks and dance offbeats",()=>{const before=structuredClone(song);const x=analyzeBassPocket(song);assert.equal(x.kickCount,2);assert.equal(x.bassCount,3);assert.equal(x.lockedCount,2);assert.equal(x.offbeatCount,1);assert.equal(x.overlapCount,0);assert.deepEqual(song,before);});
test("detects overlapping bass notes without changing MIDI",()=>{const s=structuredClone(song);s.tracks[1].notes[0].duration=2;assert.equal(analyzeBassPocket(s).overlapCount,1);});
test("empty tracks and tempo defaults remain safe",()=>{const x=analyzeBassPocket({tracks:[]});assert.equal(x.bassCount,0);assert.equal(x.kickCount,0);assert.equal(x.medianNearestKickDeltaMs,null);});
