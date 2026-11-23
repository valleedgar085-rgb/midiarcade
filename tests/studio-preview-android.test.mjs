import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Studio audition APK has a separate install identity without changing the regular app", () => {
  const build = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");
  assert.match(build, /applicationId "com\.midiarcade\.app"/);
  assert.match(build, /debug\s*\{\s*applicationIdSuffix "\.preview"/);
  const studio = build.match(/studioPreview\s*\{([^}]+)\}/)?.[1];
  assert.ok(studio, "a separate Studio Preview build avoids an incompatible-key upgrade");
  assert.match(studio, /initWith debug/);
  assert.match(studio, /applicationIdSuffix "\.studio\.preview"/);
  assert.match(studio, /matchingFallbacks = \['debug'\]/);
  assert.match(studio, /versionNameSuffix "-studio-preview"/);
  const labels = readFileSync(new URL("../android/app/src/studioPreview/res/values/strings.xml", import.meta.url), "utf8");
  assert.match(labels, /name="app_name">MIDI Arcade Studio Preview/);
  assert.match(labels, /name="title_activity_main">MIDI Arcade Studio Preview/);
});
