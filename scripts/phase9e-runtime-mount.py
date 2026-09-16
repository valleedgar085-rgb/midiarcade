from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one marker, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Keep the protected initial HTML budget: Create presentation mounts the control
# before app listener/session wiring, while the contract remains first-class.
replace_once(
    "index.html",
    '''                <label class="create-live-select creative-range-control">\n                  <span>CREATIVE RANGE</span>\n                  <select id="creativeRangeControl" aria-label="Creative range">\n                    <option value="" selected>Default · existing behavior</option>\n                    <option value="familiar">Familiar · stay close</option>\n                    <option value="fresh">Fresh · balanced ideas</option>\n                    <option value="wild">Wild · explore safely</option>\n                  </select>\n                </label>\n''',
    "",
)

replace_once(
    "src/ui/create-workflow-phase1.js",
    '''function moveGenerationEssentials(rootDocument, createPanel) {\n''',
    '''function mountCreativeRangeControl(rootDocument, createPanel) {\n  const controls = createPanel.querySelector(".create-live-controls");\n  if (!controls || controls.querySelector("#creativeRangeControl") || typeof rootDocument?.createElement !== "function") return false;\n\n  const label = rootDocument.createElement("label");\n  label.className = "create-live-select creative-range-control";\n  label.innerHTML = `\n    <span>CREATIVE RANGE</span>\n    <select id="creativeRangeControl" aria-label="Creative range">\n      <option value="" selected>Default · existing behavior</option>\n      <option value="familiar">Familiar · stay close</option>\n      <option value="fresh">Fresh · balanced ideas</option>\n      <option value="wild">Wild · explore safely</option>\n    </select>\n  `;\n  controls.append(label);\n  return true;\n}\n\nfunction moveGenerationEssentials(rootDocument, createPanel) {\n''',
)

replace_once(
    "src/ui/create-workflow-phase1.js",
    '''  upgradeStaticCreateCopy(rootDocument, createPanel);\n  moveGenerationEssentials(rootDocument, createPanel);\n''',
    '''  mountCreativeRangeControl(rootDocument, createPanel);\n  upgradeStaticCreateCopy(rootDocument, createPanel);\n  moveGenerationEssentials(rootDocument, createPanel);\n''',
)

# Creative Range UI contract proves runtime mounting and zero static-HTML cost.
p = Path("tests/creative-range-ui.test.mjs")
text = p.read_text()
old = '''const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");\nconst app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");\nconst sessionRuntime = fs.readFileSync(new URL("../src/core/session-runtime.js", import.meta.url), "utf8");\n\ntest("Create exposes one neutral-by-default Creative Range selector", () => {\n  const block = html.match(/<select id="creativeRangeControl"[\\s\\S]*?<\\/select>/)?.[0] ?? "";\n  assert.match(block, /<option value="" selected>Default · existing behavior<\\/option>/);\n  for (const value of ["familiar", "fresh", "wild"]) {\n    assert.equal((block.match(new RegExp(`value="${value}"`, "g")) || []).length, 1);\n  }\n});\n'''
new = '''const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");\nconst app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");\nconst presentation = fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");\nconst sessionRuntime = fs.readFileSync(new URL("../src/core/session-runtime.js", import.meta.url), "utf8");\n\ntest("Create mounts one neutral-by-default Creative Range selector without growing initial HTML", () => {\n  const block = presentation.match(/function mountCreativeRangeControl[\\s\\S]*?function moveGenerationEssentials/)?.[0] ?? "";\n  assert.equal((html.match(/creativeRangeControl/g) || []).length, 0, "Creative Range must not consume the protected initial HTML budget");\n  assert.equal((block.match(/id="creativeRangeControl"/g) || []).length, 1);\n  assert.match(block, /<option value="" selected>Default · existing behavior<\\/option>/);\n  for (const value of ["familiar", "fresh", "wild"]) {\n    assert.equal((block.match(new RegExp(`value="${value}"`, "g")) || []).length, 1);\n  }\n  assert.match(presentation, /mountCreativeRangeControl\\(rootDocument, createPanel\\);[\\s\\S]*?applyCreateControlContract\\(rootDocument, createPanel\\);/);\n});\n'''
if text.count(old) != 1:
    raise SystemExit("creative-range-ui test marker missing")
p.write_text(text.replace(old, new, 1))

# Preserve fail-closed Create inventory: runtime controls are an explicit narrow set.
p = Path("tests/create-control-contract.test.mjs")
text = p.read_text()
marker = '''const RANGE_IDS = [\n'''
if text.count(marker) != 1:
    raise SystemExit("contract test RANGE_IDS marker missing")
text = text.replace(
    marker,
    '''const RUNTIME_CREATE_IDS = ["creativeRangeControl"];\nconst STATIC_CREATE_IDS = EXPECTED_CREATE_IDS.filter((id) => !RUNTIME_CREATE_IDS.includes(id));\n\nconst RANGE_IDS = [\n''',
    1,
)

old = '''  for (const id of CREATE_CONTROL_IDS) {\n    assert.equal((createHtml.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must exist exactly once in Create`);\n  }\n});\n'''
new = '''  for (const id of STATIC_CREATE_IDS) {\n    assert.equal((createHtml.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must exist exactly once in static Create HTML`);\n  }\n  for (const id of RUNTIME_CREATE_IDS) {\n    assert.equal((createHtml.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 0, `${id} must stay out of protected initial HTML`);\n    assert.equal((createPresentation.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be mounted exactly once by Create presentation`);\n  }\n});\n'''
if text.count(old) != 1:
    raise SystemExit("contract existence assertion marker missing")
text = text.replace(old, new, 1)

old = '''  assert.equal(idTags.length, CREATE_CONTROL_IDS.length, "every ID-based Create interactive must be declared in CREATE_CONTROL_CONTRACT");\n'''
new = '''  assert.equal(idTags.length, STATIC_CREATE_IDS.length, "every static ID-based Create interactive must be declared in CREATE_CONTROL_CONTRACT");\n'''
if text.count(old) != 1:
    raise SystemExit("contract idTags count marker missing")
text = text.replace(old, new, 1)

old = '''  assert.equal(interactiveTags.length, CREATE_CONTROL_IDS.length + CREATE_SELECTOR_CONTRACT.length + variationTags.length, "adding any Create interactive requires an explicit contract entry");\n'''
new = '''  assert.equal(interactiveTags.length, STATIC_CREATE_IDS.length + CREATE_SELECTOR_CONTRACT.length + variationTags.length, "adding any static Create interactive requires an explicit contract entry");\n  assert.deepEqual(RUNTIME_CREATE_IDS, ["creativeRangeControl"], "runtime-mounted Create controls must remain an explicit, narrow exception");\n'''
if text.count(old) != 1:
    raise SystemExit("contract interactive count marker missing")
text = text.replace(old, new, 1)

old = '''  const calls = createPresentation.match(/upgradeStaticCreateCopy\\(rootDocument, createPanel\\);[\\s\\S]*?moveGenerationEssentials\\(rootDocument, createPanel\\);[\\s\\S]*?consolidateAdvancedDirection\\(rootDocument, createPanel\\);[\\s\\S]*?moveOptionalGuide\\(createPanel\\);[\\s\\S]*?applyCreateControlContract\\(rootDocument, createPanel\\);/);\n'''
new = '''  const calls = createPresentation.match(/mountCreativeRangeControl\\(rootDocument, createPanel\\);[\\s\\S]*?upgradeStaticCreateCopy\\(rootDocument, createPanel\\);[\\s\\S]*?moveGenerationEssentials\\(rootDocument, createPanel\\);[\\s\\S]*?consolidateAdvancedDirection\\(rootDocument, createPanel\\);[\\s\\S]*?moveOptionalGuide\\(createPanel\\);[\\s\\S]*?applyCreateControlContract\\(rootDocument, createPanel\\);/);\n'''
if text.count(old) != 1:
    raise SystemExit("contract presentation order marker missing")
text = text.replace(old, new, 1)
p.write_text(text)

# Global selector smoke contract: permit only the explicitly inventoried pre-wiring
# Create mount; every other app selector still must exist in static index.html.
p = Path("tests/app-smoke.test.mjs")
text = p.read_text()
old = '''const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");\nconst copyCatalogSource = await readFile(new URL("../src/ui/copy-catalog.js", import.meta.url), "utf8");\n'''
new = '''const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");\nconst createPresentationSource = await readFile(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");\nconst copyCatalogSource = await readFile(new URL("../src/ui/copy-catalog.js", import.meta.url), "utf8");\n'''
if text.count(old) != 1:
    raise SystemExit("app-smoke source marker missing")
text = text.replace(old, new, 1)

old = '''  const referencedIds = [...appSource.matchAll(/\\$\\("#([A-Za-z][\\w-]*)"\\)/g)].map((match) => match[1]);\n  for (const id of new Set(referencedIds)) assert.ok(ids.includes(id), `#${id} must exist in index.html`);\n'''
new = '''  const referencedIds = [...appSource.matchAll(/\\$\\("#([A-Za-z][\\w-]*)"\\)/g)].map((match) => match[1]);\n  const runtimeMountedIds = new Set(["creativeRangeControl"]);\n  for (const id of new Set(referencedIds)) {\n    if (ids.includes(id)) continue;\n    assert.ok(\n      runtimeMountedIds.has(id) && new RegExp(`id=["']${id}["']`).test(createPresentationSource),\n      `#${id} must exist in index.html or an explicitly inventoried pre-wiring Create mount`,\n    );\n  }\n  assert.deepEqual([...runtimeMountedIds], ["creativeRangeControl"], "runtime selector exceptions must remain narrow and explicit");\n'''
if text.count(old) != 1:
    raise SystemExit("app-smoke selector marker missing")
text = text.replace(old, new, 1)
p.write_text(text)

# Document why this is runtime-mounted.
p = Path("docs/phase9e-creative-range.md")
text = p.read_text()
old = '''- The selection participates in staged-direction detection, Reset direction, and session preference restore.\n'''
new = '''- The selection participates in staged-direction detection, Reset direction, and session preference restore.\n- The selector is mounted by the existing Create presentation boundary before runtime wiring, keeping the protected initial HTML budget unchanged.\n'''
if text.count(old) != 1:
    raise SystemExit("phase9e doc marker missing")
p.write_text(text.replace(old, new, 1))
