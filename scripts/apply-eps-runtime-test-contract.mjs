import fs from "node:fs";

const path = "tests/app-smoke.test.mjs";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`EPS test-contract patch missing: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`EPS test-contract patch ambiguous: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
`  const previousPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  elementFor("#generateNew").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 520));
  const newPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  assert.equal(Object.keys(newPrograms).length, 6);
  for (const id of Object.keys(newPrograms)) {
    assert.notEqual(newPrograms[id], previousPrograms[id], \`New Idea should change \${id}'s sound\`);
    assert.notEqual(
      app.previewVoice(id, newPrograms[id]).character,
      app.previewVoice(id, previousPrograms[id]).character,
      \`New Idea should change \${id}'s audible character\`,
    );
  }
`,
`  const previousPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  elementFor("#generateNew").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 520));
  const newPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  assert.equal(Object.keys(newPrograms).length, 6);
  assert.deepEqual(
    newPrograms,
    previousPrograms,
    "manual instrument programs must remain pinned when New generates a different song",
  );
  for (const id of Object.keys(newPrograms)) {
    assert.equal(
      app.previewVoice(id, newPrograms[id]).character,
      app.previewVoice(id, previousPrograms[id]).character,
      \`manual \${id} program must keep its audible character until Auto is restored\`,
    );
  }
`,
"manual program pin contract",
);

replaceOnce(
`  elementFor("#resetControlsButton").dispatch("click");
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(neoSoul.tripletChance * 100));
  assert.equal(Number(elementFor("#rollControl").value), Math.round(neoSoul.snareRollChance * 100));
  assert.equal(elementFor("#chordPathControl").value, "auto", "Reset must keep chord path in AUTO mode");

  assert.equal(app.saveSessionNow(), true, "a valid song session must save locally on demand");
`,
`  elementFor("#resetControlsButton").dispatch("click");
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(neoSoul.tripletChance * 100));
  assert.equal(Number(elementFor("#rollControl").value), Math.round(neoSoul.snareRollChance * 100));
  assert.equal(elementFor("#chordPathControl").value, "auto", "Reset must keep chord path in AUTO mode");

  const programsBeforeAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)
    .map(([id, settings]) => [id, Number(settings.program)]));
  elementFor("#generateNew").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 520));
  const programsAfterAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)
    .map(([id, settings]) => [id, Number(settings.program)]));
  assert.ok(
    Object.keys(programsBeforeAutoNew).some((id) => programsAfterAutoNew[id] !== programsBeforeAutoNew[id]),
    "Reset must restore Auto authority so New may rotate instrument programs",
  );
  for (const [id, program] of Object.entries(programsAfterAutoNew)) {
    assert.ok(
      GENRE_PROFILES.neoSoul.instrumentPrograms[id].includes(program),
      \`Auto \${id} program \${program} must remain inside the active genre palette\`,
    );
  }

  assert.equal(app.saveSessionNow(), true, "a valid song session must save locally on demand");
`,
"Auto program reset integration contract",
);

replaceOnce(
`  assert.ok(savedSession.autoControls.includes("chordPathControl"), "Reset must persist chord path auto selection");
`,
`  assert.ok(savedSession.autoControls.includes("chordPathControl"), "Reset must persist chord path auto selection");
  assert.ok(savedSession.autoControls.includes("track:drums:program"), "Reset must persist instrument program Auto authority");
`,
"persisted Auto program authority",
);

fs.writeFileSync(path, source);
console.log("EPS runtime smoke contract updated with manual-pin and Auto-rotation coverage.");
