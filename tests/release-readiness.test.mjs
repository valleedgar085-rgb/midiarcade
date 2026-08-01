import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("shipped text assets are UTF-8 clean and preserve protected product copy", async () => {
  const sourceFiles = [
    "index.html",
    "styles.css",
    "privacy-policy.html",
    "manifest.webmanifest",
    "src/app.js",
    "src/music-engine.js",
    "src/ui/copy-catalog.js",
  ];
  const mojibake = /(?:â€”|â€“|â€™|â€œ|â€|âœ|â†|â‡|â™|âš|â›|â—|â‰|âŒ|ðŸ|Â·|ï¿½|\uFFFD)/u;

  for (const path of sourceFiles) {
    const source = await read(path);
    assert.doesNotMatch(source, mojibake, `${path} must not contain mojibake`);
  }

  const html = await read("index.html");
  assert.match(html, /<meta charset="UTF-8"/);
  assert.match(html, /6 SOUND-READY MIDI TRACKS/);
});

test("Android release configuration targets the current Play baseline without broad media access", async () => {
  const [variables, appGradle, androidManifest, styles, mainActivity, plugin, capacitorConfig, framer, webStyles] = await Promise.all([
    read("android/variables.gradle"),
    read("android/app/build.gradle"),
    read("android/app/src/main/AndroidManifest.xml"),
    read("android/app/src/main/res/values/styles.xml"),
    read("android/app/src/main/java/com/midiarcade/app/MainActivity.java"),
    read("android/app/src/main/java/com/midiarcade/app/MidiInputPlugin.java"),
    read("capacitor.config.json"),
    read("android/app/src/main/java/com/midiarcade/app/MidiStreamFramer.java"),
    read("styles.css"),
  ]);

  assert.match(variables, /minSdkVersion\s*=\s*24/);
  assert.match(variables, /compileSdkVersion\s*=\s*36/);
  assert.match(variables, /targetSdkVersion\s*=\s*36/);
  assert.match(appGradle, /versionCode\s+2/);
  assert.match(appGradle, /versionName\s+"1\.1\.0"/);
  assert.doesNotMatch(androidManifest, /INTERNET|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_MEDIA_AUDIO/);
  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(androidManifest, /android\.software\.midi/);
  assert.match(androidManifest, /@mipmap\/ic_launcher_v2/);
  assert.match(styles, /postSplashScreenTheme/);
  assert.match(mainActivity, /registerPlugin\(MidiInputPlugin\.class\)/);
  assert.match(plugin, /MidiManager/);
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"MidiInput"\)/);
  assert.match(plugin, /disconnectConnectionIfMatching\(requestedConnectionId\)/, "stale JS cleanup must not cancel a newer native MIDI request");
  assert.match(plugin, /!requested\.equals\(activeConnectionId\)/, "native disconnect must validate the exact active connection id");
  assert.match(framer, /class MidiStreamFramer/);
  const config = JSON.parse(capacitorConfig);
  assert.equal(config.plugins.SystemBars.insetsHandling, "css");
  assert.equal(config.plugins.SystemBars.hidden, false);
  assert.match(webStyles, /var\(--safe-area-inset-bottom,\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
});

test("PWA and Play artwork is versioned, present, and wired into the studio product", async () => {
  const [packageJson, webManifest, html, appSource] = await Promise.all([
    read("package.json"),
    read("manifest.webmanifest"),
    read("index.html"),
    read("src/app.js"),
  ]);
  const pkg = JSON.parse(packageJson);
  const manifest = JSON.parse(webManifest);

  assert.equal(pkg.version, "1.1.0");
  assert.equal(pkg.engines.node, ">=22.0.0");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.match(html, /id="heroPanel"/);
  assert.match(appSource, /createMidiInputManager/);

  for (const path of [
    "assets/brand/icon-192-v2.png",
    "assets/brand/icon-512-v2.png",
    "assets/store/play-icon-512-v2.png",
    "assets/store/play-feature-graphic-1024x500-v2.png",
  ]) {
    const url = new URL(path, root);
    await access(url);
    assert.ok((await stat(url)).size > 10_000, `${path} must contain production artwork`);
  }

  const playIcon = await readFile(new URL("assets/store/play-icon-512-v2.png", root));
  assert.equal(playIcon.readUInt32BE(16), 512, "Play icon width must be 512px");
  assert.equal(playIcon.readUInt32BE(20), 512, "Play icon height must be 512px");
  assert.equal(playIcon[25], 6, "Play icon must be RGBA so its transparency is preserved");

  const featureGraphic = await readFile(new URL("assets/store/play-feature-graphic-1024x500-v2.png", root));
  assert.equal(featureGraphic.readUInt32BE(16), 1024, "feature graphic width must be 1024px");
  assert.equal(featureGraphic.readUInt32BE(20), 500, "feature graphic height must be 500px");
});

test("privacy policy is publishable, locally bundled, and accessible inside the app", async () => {
  const [policy, sourcePolicy, html, buildScript] = await Promise.all([
    read("privacy-policy.html"),
    read("docs/PRIVACY.md"),
    read("index.html"),
    read("scripts/build.js"),
  ]);

  assert.match(policy, /<title>Privacy Policy — MIDI Arcade<\/title>/);
  assert.match(policy, /com\.midiarcade\.app/);
  assert.match(policy, /Information not collected by the developer/);
  assert.match(policy, /Retention, deletion, and backups/);
  assert.match(policy, /does not declare the Android Internet permission/);
  assert.match(policy, /App support/);
  assert.doesNotMatch(policy, /\[REQUIRED|YOUR SUPPORT EMAIL|PUBLIC POLICY URL/i);
  assert.doesNotMatch(sourcePolicy, /\[REQUIRED|YOUR SUPPORT EMAIL|PUBLIC POLICY URL/i);
  assert.match(html, /id="menuItemPrivacy" href="\.\/privacy-policy\.html"/);
  assert.match(buildScript, /privacy-policy\.html/);
});

test("production build has explicit size, UI-density, and CSS performance budgets", async () => {
  const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const qualitySource = await readFile(new URL("../scripts/check-build-quality.js", import.meta.url), "utf8");
  assert.match(packageSource, /"quality":\s*"npm test && npm run build && node scripts\/check-build-quality\.js"/);
  assert.match(packageSource, /"test:coverage":\s*"node --test --experimental-test-coverage"/);
  assert.match(qualitySource, /"www\/src\/app\.js":\s*360 \* 1024/);
  assert.match(qualitySource, /"www\/src\/generation-worker\.js":\s*320 \* 1024/);
  assert.match(qualitySource, /buttonCount > 94/);
  assert.match(qualitySource, /transitionAllCount > 30/);
  assert.match(qualitySource, /content-visibility:auto/);
});
