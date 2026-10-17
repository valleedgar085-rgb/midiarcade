import { evaluateChorusHookRecurrence } from "../../src/core/chorus-hook-recurrence.js";
import { inspectHookNoteEvidence } from "./hook-note-evidence.mjs";

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const type=section=>String(section?.name??section?.type??"").toLowerCase().replace(/[^a-z0-9]/g,"");
const chorus=section=>/^(chorus|hook|refrain)/.test(type(section));
const sum=values=>values.reduce((a,b)=>a+b,0);

/**
 * Read-only provenance audit of the *existing* generation authorities.
 * It distinguishes lost upstream identity from downstream drift; neither
 * source song nor score/thresholds nor the real generator are altered.
 */
export function inspectHookLineage(song){
  const sections=song?.structure??song?.sections??[];
  const hookSections=sections.filter(chorus);
  const assignments=new Map((song?.motifs?.sectionAssignments??[]).map(entry=>[String(entry.sectionId),entry]));
  const memories=new Map((song?.memoryMap??[]).map(entry=>[String(entry.sectionId),entry]));
  const phrases=new Map((song?.phraseMemory?.sections??[]).map(entry=>[String(entry.sectionId),entry]));
  const tracks=(song?.tracks??[]).find(t=>t.id==="melody")?.notes??[];
  const output=evaluateChorusHookRecurrence(song);
  const origin=hookSections[0];
  const originId=String(origin?.id??"");
  const originFamily=assignments.get(originId)?.motifId??null;
  const returns=hookSections.slice(1).map(section=>{
    const id=String(section.id);
    const assignment=assignments.get(id)??null;
    const memory=memories.get(id)??null;
    const phrase=phrases.get(id)??null;
    const cmp=output.comparisons?.find(c=>c.sectionId===id)??null;
    const starts=(tracks??[]).filter(note=>
      finite(note?.start,-1)>=finite(section.startBeat,0)-1e-6&&
      finite(note?.start,-1)<finite(section.endBeat,0)-1e-6);
    return {
      sectionId:id,sourceSectionId:originId,sectionName:type(section),
      motifId:assignment?.motifId??null,sourceMotifId:originFamily,
      motifFamilyPreserved:Boolean(originFamily&&assignment?.motifId===originFamily),
      memorySourceId:memory?.originSectionId??null,
      phraseSourceId:phrase?.sourceSectionId??null,
      memorySourcePreserved:String(memory?.originSectionId??"")===originId,
      phraseSourcePreserved:String(phrase?.sourceSectionId??"")===originId,
      phraseRecallStrength:finite(phrase?.recallStrength,null),
      hookRole:phrase?.hookRole??null,
      noteCount:starts.length,hookScore:cmp?.available?Math.round(cmp.score*100):null,
      noteEvidence:inspectHookNoteEvidence(song,originId,id,cmp),
      hookRhythm:cmp?.available?cmp.rhythm:null,
      hookContour:cmp?.available?cmp.contour:null,
      sourceOnsetCoverage:cmp?.sourceOnsetCoverage??null,
      returnOnsetCoverage:cmp?.returnOnsetCoverage??null,
      endingCoverage:cmp?.duration??null,
      issue:!assignment?"missing-motif-assignment":
        !originFamily?"missing-source-motif":
        assignment.motifId!==originFamily?"motif-family-divergence":
        String(memory?.originSectionId??"")!==originId?"memory-map-divergence":
        String(phrase?.sourceSectionId??"")!==originId?"phrase-source-divergence":
        cmp?.available&&cmp.score<0.66?"downstream-note-identity-drift":
        cmp?.available?"retained-after-render":"insufficient-note-evidence",
    };
  });
  return {
    genre:String(song?.meta?.genre??song?.genre??""),
    hookStatus:output.status,hookScore:output.score,
    sourceSectionId:originId,sourceMotifId:originFamily,
    returns,
    loss: {
      motif:sum(returns.map(r=>Number(!r.motifFamilyPreserved))),
      memory:sum(returns.map(r=>Number(!r.memorySourcePreserved))),
      phrase:sum(returns.map(r=>Number(!r.phraseSourcePreserved))),
      downstream:sum(returns.map(r=>Number(r.issue==="downstream-note-identity-drift"))),
      preserved:sum(returns.map(r=>Number(r.issue==="retained-after-render"))),
    },
  };
}
