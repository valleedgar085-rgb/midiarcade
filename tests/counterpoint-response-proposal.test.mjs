import test from "node:test";
import assert from "node:assert/strict";
import {proposeCounterpointResponses} from "../src/core/counterpoint-response-proposal.js";
test("deterministically moves a short answer into lead rest without changing pitch",()=>{
 const lead=[{start:0,duration:0.5,pitch:72}];
 const counter=[{start:0.25,duration:0.25,pitch:64,velocity:80}];
 const first=proposeCounterpointResponses(lead,counter);
 assert.deepEqual(first,proposeCounterpointResponses(lead,counter));
 assert.equal(first.notes[0].start,0.5);
 assert.equal(first.notes[0].pitch,64);
 assert.equal(first.notes[0].velocity,80);
 assert.equal(counter[0].start,0.25);
});
test("does not invent space when a response cannot move",()=>{
 const result=proposeCounterpointResponses([{start:0,duration:2}], [{start:0,duration:0.25,pitch:60}],{sectionEndBeat:0.5});
 assert.equal(result.changed,0);
 assert.equal(result.unresolved,1);
});
