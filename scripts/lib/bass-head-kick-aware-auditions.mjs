/**
 * Bass Head Phase 5 — actual-kick-aware SHADOW audition selector.
 * Only selects existing, protected bounce proposals. Never rewrites MIDI,
 * alters production authority, or claims objective listening superiority.
 */
import {createBassHeadBounceCandidates} from "../../src/core/groove-pocket-refinement.js";
import {inspectBassHeadTimingChanges} from "./bass-head-timing-context.mjs";

const approvedRoles=new Set(["response","anticipation"]);
const stable=x=>JSON.stringify(x);
function classification(note){
 const from=note.originalKick?.role;
 const to=note.proposedKick?.role;
 const before=note.originalKick?.signedOffsetBeats;
 const after=note.proposedKick?.signedOffsetBeats;
 if(to==="response"&&from!=="response"&&after>0)return "response";
 if(to==="anticipation"&&from!=="anticipation"&&after<0)return "anticipation";
 // A shift that stays on the same side of the kick is not a new role.
 if(to==="anticipation"&&from==="anticipation"&&Math.abs(after)<Math.abs(before))
   return "stronger-anticipation";
 if(to==="response"&&from==="response"&&Math.abs(after)<Math.abs(before))
   return "tighter-response";
 return "other";
}
export function inspectBassHeadCandidateRoles(original,candidate){
 const report=inspectBassHeadTimingChanges(original,candidate);
 const roles=report.notes.map(n=>n.status==="measured"?classification(n):"unmatched");
 const counts=Object.fromEntries(["response","anticipation","stronger-anticipation",
  "tighter-response","other","unmatched"].map(role=>[role,roles.filter(r=>r===role).length]));
 return {status:report.status,changedNotes:report.changedNotes,roles,counts,
  notes:report.notes,baselineOnly:true};
}
/**
 * Return proposed *auditions* grouped by observed relationship to actual kick.
 * Never treat the string "kick-answer" as proof that a note follows a kick.
 * The original song remains the only authoritative production output.
 */
export function planKickAwareBassAuditions(song,{
 enabled=false,allowMixed=false,maxChanges=8,
}={}){
 const result={baseline:"original",defaultActivationAllowed:false,
   candidates:[],rejected:[],experimentalOnly:true};
 if(enabled!==true)return result;
 const proposals=createBassHeadBounceCandidates(song,{bassHeadBounceV1:true});
 const sourceSnapshot=stable(song);
 for(const proposal of proposals){
  const detail=inspectBassHeadCandidateRoles(song,proposal.song);
  const measured=detail.changedNotes>0&&detail.status==="measured"
    &&detail.roles.length===detail.changedNotes
    &&detail.changedNotes<=maxChanges;
  const novel=detail.roles.filter(r=>approvedRoles.has(r));
  const eligible=measured&&novel.length>0
    &&(allowMixed||novel.length===detail.changedNotes);
  const row={id:proposal.id,changedNotes:proposal.changedNotes,
    dominantRole:detail.counts.response>detail.counts.anticipation?"response"
      :detail.counts.anticipation>detail.counts.response?"anticipation":"mixed",
    counts:detail.counts,notes:detail.notes,eligible,
    reason:!measured?"unmeasured-or-over-budget"
      :!novel.length?"no-new-kick-relative-role"
      :!allowMixed&&novel.length!==detail.changedNotes?"mixed-kick-roles":"audition-only",
    ...(eligible?{song:proposal.song}:{})};
  if(eligible)result.candidates.push(row);else result.rejected.push(row);
 }
 if(stable(song)!==sourceSnapshot)throw new Error("Shadow audition mutated original song");
 result.candidates.sort((a,b)=>a.dominantRole.localeCompare(b.dominantRole)||a.id.localeCompare(b.id));
 return result;
}
