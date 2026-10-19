import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  INSTRUMENT_INTELLIGENCE, INSTRUMENT_INTELLIGENCE_KEY,
  defaultInstrumentIntelligence, normalizeInstrumentIntelligence,
  loadInstrumentIntelligence, saveInstrumentIntelligence,
  resolveInstrumentIntelligence,
} from "../src/ui/instrument-intelligence.js";

test("seven distinct instrument controls start Auto and preserve defaults", () => {
  assert.deepEqual(INSTRUMENT_INTELLIGENCE.map(x=>x.id),[
    "drums","bass","chords","melody","counterpoint","pad","arp"
  ]);
  const settings=defaultInstrumentIntelligence();
  assert.ok(Object.values(settings).every(x=>x.auto));
  const base={syncopation:.43,trackControls:{bass:{variation:.6},drums:{variation:.7}},tracks:null};
  base.tracks=base.trackControls;
  assert.equal(resolveInstrumentIntelligence(base,settings),base);
});
test("manual drums and bass use bounded established engine controls without mutating source", () => {
  const base={syncopation:.46,trackControls:{bass:{variation:.6,density:.52},drums:{density:.73}},tracks:null};
  base.tracks=base.trackControls;
  const initial=JSON.stringify(base);
  const result=resolveInstrumentIntelligence(base,{
    drums:{auto:false,value:90}, bass:{auto:false,value:80},
  });
  assert.equal(result.syncopation,.1);
  assert.ok(result.trackControls.bass.variation < base.trackControls.bass.variation);
  assert.equal(result.trackControls.bass.density,.52);
  assert.equal(result.tracks,result.trackControls);
  assert.equal(JSON.stringify(base),initial);
});
test("disabled future mappings remain neutral and persisted values safely normalize", () => {
  const base={syncopation:.5,trackControls:{bass:{variation:.3}}};
  assert.equal(resolveInstrumentIntelligence(base,{
    drums:{auto:true,value:5},bass:{auto:true,value:5},
    chords:{auto:false,value:100},melody:{auto:false,value:100},
  }),base);
  const memory=new Map();
  const storage={
    getItem:key=>memory.get(key)??null,
    setItem:(key,value)=>memory.set(key,value),
  };
  const saved=saveInstrumentIntelligence({drums:{auto:false,value:125},bass:{auto:false,value:-9}},storage);
  assert.equal(saved.drums.value,100);
  assert.equal(saved.bass.value,0);
  assert.deepEqual(loadInstrumentIntelligence(storage),saved);
  memory.set(INSTRUMENT_INTELLIGENCE_KEY,"{bad");
  assert.deepEqual(loadInstrumentIntelligence(storage),defaultInstrumentIntelligence());
  assert.equal(normalizeInstrumentIntelligence(null).drums.auto,true);
});
test("config wiring only changes generation configuration, never MIDI encoding",()=>{
  const app=fs.readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
  const presentation=fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js",import.meta.url),"utf8");
  const span=app.match(/export function buildConfig[\s\S]*?const GENERATION_SETTING_IDS/)?.[0]??"";
  assert.match(span,/return resolveInstrumentIntelligence\(\{/);
  assert.match(presentation,/consolidateCreateSurface\(rootDocument, createPanel\);\s*mountInstrumentIntelligence\(rootDocument, createPanel\);/);
  assert.doesNotMatch(span,/encodeMidi|midi\.write/);
});
