import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./apply-shape-director-ui.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const replacements = [
  [
    '  if (noteCount) noteCount.textContent = `${state.editorSelection?.size || 0} selected notes`;',
    '  if (noteCount) noteCount.textContent = String(state.editorSelection?.size || 0) + " selected notes";',
  ],
  [
    '  $("#shapeDirectorCandidateTitle").textContent = `${director.transaction.intent.direction.label} · ${director.transaction.intent.size.label}`;',
    '  $("#shapeDirectorCandidateTitle").textContent = director.transaction.intent.direction.label + " · " + director.transaction.intent.size.label;',
  ],
  [
    '  $("#shapeDirectorCandidateMeta").textContent = `${summary.changedNoteCount} shaped · ${summary.insertedNoteCount} added · ${summary.deletedNoteCount} removed · ${summary.scopeNoteCount} notes in scope`;',
    '  $("#shapeDirectorCandidateMeta").textContent = summary.changedNoteCount + " shaped · " + summary.insertedNoteCount + " added · " + summary.deletedNoteCount + " removed · " + summary.scopeNoteCount + " notes in scope";',
  ],
  [
    '    seed: `shape:${state.generationCount}:${section.id}:${state.editorTrack}:${direction}:${director.size}`,' ,
    '    seed: "shape:" + state.generationCount + ":" + section.id + ":" + state.editorTrack + ":" + direction + ":" + director.size,',
  ],
  [
    '  showToast(`${transaction.intent.direction.label} candidate ready. Compare Before and After before committing.`);',
    '  showToast(transaction.intent.direction.label + " candidate ready. Compare Before and After before committing.");',
  ],
  [
    '  showToast(`${label} is now part of this section. Undo can restore the previous version.`);',
    '  showToast(label + " is now part of this section. Undo can restore the previous version.");',
  ],
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one harness fragment, found ${count}: ${before.slice(0, 72)}`);
  source = source.replace(before, after);
}

await writeFile(path, source);
console.log("Repaired nested template literals in Shape Director UI harness.");
