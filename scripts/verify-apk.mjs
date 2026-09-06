import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const apk = path.resolve("android/app/build/outputs/apk/debug/app-debug.apk");
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdkRoot) throw new Error("Android SDK path is required for APK verification.");
const buildTools = path.join(sdkRoot, "build-tools");
const versions = fs.readdirSync(buildTools).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).reverse();
const directory = versions.map((version) => path.join(buildTools, version))
  .find((entry) => fs.existsSync(path.join(entry, "apksigner")) && fs.existsSync(path.join(entry, "aapt2")));
if (!directory) throw new Error("APK signing and manifest inspection tools are unavailable.");
execFileSync(path.join(directory, "apksigner"), ["verify", "--verbose", "--print-certs", apk], { stdio: "inherit" });
const badging = execFileSync(path.join(directory, "aapt2"), ["dump", "badging", apk], { encoding: "utf8" });
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const packageLine = badging.split("\n").find((line) => line.startsWith("package:")) ?? "";
if (!packageLine.includes("name='com.midiarcade.app.preview'") || !packageLine.includes(`versionName='${version}-preview'`)) {
  throw new Error(`Unexpected APK package/version: ${packageLine}`);
}
const bytes = fs.readFileSync(apk);
console.log(packageLine);
console.log(`APK bytes: ${bytes.length}`);
console.log(`APK SHA-256: ${createHash("sha256").update(bytes).digest("hex")}`);
