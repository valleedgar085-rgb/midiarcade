import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Android registers an offline generation database without adding runtime permissions", async () => {
  const [mainActivity, plugin, manifest] = await Promise.all([
    read("android/app/src/main/java/com/midiarcade/app/MainActivity.java"),
    read("android/app/src/main/java/com/midiarcade/app/GenerationDatabasePlugin.java"),
    read("android/app/src/main/AndroidManifest.xml"),
  ]);

  assert.match(mainActivity, /registerPlugin\(GenerationDatabasePlugin\.class\)/);
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"GenerationDatabase"\)/);
  assert.match(plugin, /SQLiteOpenHelper/);
  assert.match(plugin, /midi_arcade\.db/);
  assert.match(plugin, /setForeignKeyConstraintsEnabled\(true\)/);
  assert.match(plugin, /persistGeneration\(PluginCall call\)/);
  assert.match(plugin, /recentRuns\(PluginCall call\)/);
  assert.match(plugin, /SCHEMA_ASSET\s*=\s*"midi_arcade_schema\.sql"/);
  assert.doesNotMatch(manifest, /INTERNET|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_AUDIO/);
});

test("Android build ships the canonical SQL schema instead of a duplicated Java schema", async () => {
  const [build, schema, plugin] = await Promise.all([
    read("scripts/build.js"),
    read("database/midi_arcade_schema.sql"),
    read("android/app/src/main/java/com/midiarcade/app/GenerationDatabasePlugin.java"),
  ]);

  assert.match(build, /database.*midi_arcade_schema\.sql/s);
  assert.match(build, /androidAssetsDir/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS groove_dna/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS musical_events/);
  assert.match(schema, /source_section_id TEXT/);
  assert.doesNotMatch(plugin, /CREATE TABLE IF NOT EXISTS/, "native plugin should load the canonical schema asset");
});

test("app enables persistence only when the native database plugin is available", async () => {
  const [app, repository, executor] = await Promise.all([
    read("src/app.js"),
    read("src/core/generation-database-repository.js"),
    read("src/core/generation-executor.js"),
  ]);

  assert.match(app, /createGenerationDatabaseRepository/);
  assert.match(app, /persistGeneration:\s*generationDatabase\.available/);
  assert.match(repository, /Capacitor\?\.Plugins\?\.GenerationDatabase/);
  assert.match(executor, /await import\("\.\/generation-database-record\.js"\)/);
  assert.doesNotMatch(executor, /^import .*generation-database-record/m, "database serializer must stay out of the default app bundle");
});
