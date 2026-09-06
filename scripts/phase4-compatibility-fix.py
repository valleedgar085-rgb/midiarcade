from pathlib import Path

engine_path = Path("src/music-engine.js")
source = engine_path.read_text()


def replace_once(before, after, label):
    global source
    if source.count(before) != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {source.count(before)}")
    source = source.replace(before, after, 1)


# Song DNA is an additive contract. Keep the mature blueprint schema at v6 so
# app and saved-session consumers do not need a migration for this phase.
replace_once(
    '''  return {
    version: 7,
    narrative: { id: narrative.id, label: narrative.label },
    songDNA,''',
    '''  return {
    version: 6,
    narrative: { id: narrative.id, label: narrative.label },
    songDNA,''',
    "additive blueprint schema",
)

# Let DNA own the long-lived melodic direction, but preserve the proven
# candidate RNG for section pattern variants. This keeps New-idea novelty and
# replay rejection intact while the DNA migration proceeds subsystem by subsystem.
replace_once(
    '''    const baseDevelopmentPath = developmentPathForTransform(motifTransform);
    const dnaSection = songDNASection(songDNA, section.id);
    const patternVariant = Number.isFinite(Number(sourcePlan?.patternVariant))
      ? mod(Math.round(sourcePlan.patternVariant), baseDevelopmentPath.length)
      : mod(dnaSection?.developmentSeed ?? rng.int(0, 0x7fffffff), baseDevelopmentPath.length);''',
    '''    const baseDevelopmentPath = developmentPathForTransform(motifTransform);
    const patternVariant = Number.isFinite(Number(sourcePlan?.patternVariant))
      ? mod(Math.round(sourcePlan.patternVariant), baseDevelopmentPath.length)
      : rng.int(0, Math.max(0, baseDevelopmentPath.length - 1));''',
    "section novelty authority",
)
replace_once(
    '''import {
  createSongDNA as createDeterministicSongDNA,
  songDNASection,
} from "./core/song-dna.js";''',
    '''import {
  createSongDNA as createDeterministicSongDNA,
} from "./core/song-dna.js";''',
    "unused Song DNA helper import",
)
engine_path.write_text(source)

# Restore the existing v6 compatibility expectation; Song DNA carries its own v2 schema.
music_test = Path("tests/music-engine.test.mjs")
tests = music_test.read_text()
old = "  assert.equal(blueprint.version, 7);"
if tests.count(old) != 1:
    raise RuntimeError(f"blueprint compatibility assertion: expected one anchor, found {tests.count(old)}")
tests = tests.replace(old, "  assert.equal(blueprint.version, 6);", 1)
music_test.write_text(tests)

# Dedicated DNA test should assert the additive contract rather than a blueprint migration.
dna_test = Path("tests/song-dna.test.mjs")
dna_tests = dna_test.read_text()
old = "  assert.equal(first.songBlueprint.version, 7);"
if dna_tests.count(old) != 1:
    raise RuntimeError(f"Song DNA blueprint assertion: expected one anchor, found {dna_tests.count(old)}")
dna_tests = dna_tests.replace(old, "  assert.equal(first.songBlueprint.version, 6);", 1)
dna_test.write_text(dna_tests)

print("Preserved blueprint compatibility and candidate novelty while keeping DNA authority over melodic direction.")
