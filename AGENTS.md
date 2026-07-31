# MIDI Arcade — Project Execution Rules & System Directives

This document defines mandatory engineering guidelines, architectural constraints, quality standards, and verification rules for developing within the **MIDI Arcade** repository (`midiarcade`).

---

## 1. Architectural Integrity & Core Engine Rules

### 1.1 Deterministic Generation Contract
- All composition, pattern, phrase, and arrangement generation in `src/music-engine.js` MUST remain **100% deterministic**.
- Use the seed-based pseudo-random generator (`createRng`) for all randomized choices. **NEVER use `Math.random()`** anywhere inside the generation pipeline or engine algorithms.

### 1.2 Scale Safety & Harmonic Separation
- Every generated note MUST adhere strictly to the active key, scale, and mode definition.
- Voicing optimization (`optimizeWholeVoicing`) MUST enforce a minimum chord pitch floor (`Math.max(48, bassCeiling + 7)`) to guarantee at least **7 semitones of clear separation** between bass and chord tracks.
- Voice-leading step penalties MUST prevent consecutive melodic leaps greater than 4 semitones in backing chord/counterpoint parts.

### 1.3 Genre Micro-Timing Envelopes
- Preserve genre-specific micro-timing envelopes:
  - Laidback Genres (Neo-Soul, Lo-Fi, R&B): apply deliberate push offsets (`+0.016` beat lag) on snares and bass.
  - Four-on-the-Floor Grid Genres (House, Techno, Synthwave, Trap): enforce strict grid timing with 50% jitter attenuation.

---

## 2. Web Audio & Synthesis Architecture

### 2.1 Fault Tolerance & Resilience
- Audio context initialization and event scheduling in `src/app.js` (`PreviewPlayer`) MUST handle browser autoplay policies, tab visibility changes (`visibilitychange`), and audio output routing changes (`devicechange`).
- Never allow unhandled Web Audio state errors to break preview playback.

### 2.2 Lowpass Filtering & Dynamic Timbre
- Maintain high-frequency noise sizzle suppression via lowpass filtering (`4.6 kHz`) on the convolver reverb return bus.
- Maintain velocity-responsive dynamic filter cutoff scaling in `scheduleEvent`.

---

## 3. UI, Aesthetics & Quality Budgets

### 3.1 Design Aesthetic Rules
- Build interfaces using **Rich Aesthetics**: vibrant HSL color palettes, dark glassmorphism (`backdrop-filter: blur(20px)`), smooth gradients, and subtle micro-animations (`transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)`).
- Avoid generic colors. Use curated HSL variables and typography (`Outfit Variable`, `Inter Variable`, `JetBrains Mono Variable`).

### 3.2 Strict Production Quality Budgets
- **Button Budget**: `index.html` MUST NOT exceed **94 `<button>` elements**. Use `<details><summary>` for expandable panels instead of adding extra buttons.
- **CSS Transition Budget**: `styles.css` MUST NOT contain more than **30 `transition: all` declarations**. Always specify target properties (e.g. `transition: transform 0.2s, opacity 0.2s`).
- **Asset Size Budgets**:
  - `www/styles.css`: <= 150 KB (minified)
  - `www/src/app.js`: <= 360 KB (minified)
  - `www/src/generation-worker.js`: <= 320 KB (minified)

---

## 4. Testing & Verification Rules

### 4.1 Mandatory Quality Gate Execution
- Before declaring ANY task complete, you MUST execute `npm run quality` via terminal command.
- `npm run quality` MUST pass with:
  1. **141/141 Unit Tests Passing** (`node --test`).
  2. **Clean Web Asset Compilation** (`node scripts/build.js`).
  3. **Passed Quality Gate Metrics** (`node scripts/check-build-quality.js`).

### 4.2 No Symptom Patches or Swallowed Errors
- NEVER resolve test failures by commenting out assertions, increasing arbitrary timeout delays, returning dummy empty array fallbacks, or swallowing exceptions in `try/catch` blocks.
- If a test fails, identify the root cause in the underlying contract and fix it strictly at the source.

---

## 5. State Management & Modular Architecture Rules

### 5.1 Pure State & Modular Separation
- Add state-independent logic to dedicated modules under `src/core/` or `src/ui/` rather than bloating `src/app.js` or `src/music-engine.js`.
- Each core module MUST expose pure, unit-testable functions without direct DOM or window dependencies.

### 5.2 Web Worker Generation Safety
- All heavy composition searches, multi-candidate quality scoring, and critic-repair passes MUST execute off the main thread in `src/generation-worker.js`.
- Never run long-running or blocking loops on the main UI thread.

### 5.3 On-Device Data & State Persistence
- All active song state, user jam takes, scoring records, and control configurations MUST auto-save locally via `src/core/session-storage.js` or `app-store.js`.
- App state restoration MUST handle cold starts, tab switches, and unexpected browser reloads without loss of player data.

---

## 6. Android & Native Integration Rules

### 6.1 Zero-Permission MIDI Standard
- Maintain the zero-permission architecture for USB/Web MIDI via Capacitor native bridges.
- **NEVER introduce runtime permissions** (storage, location, microphone, network) to `android/app/src/main/AndroidManifest.xml` or codebase.

### 6.2 Safe Native Sync Protocol
- Always run `npm run build` before `npx cap sync android` or `npm run android:sync`.
- Do NOT directly edit auto-generated files under `android/app/src/main/assets/public/` — all changes must originate in `www/` or `src/`.

### 6.3 Temporary File Cleanup on Export
- Exported `.mid` files MUST target temporary cache paths and clean up old export artifacts to avoid filling device storage.

---

## 7. MIDI Standards & Audio Performance Directives

### 7.1 Standard MIDI File (SMF) Type-1 Conformance
- Exported `.mid` files MUST maintain strict Type-1 structure with 6 named band tracks (Drums, Bass, Chords, Melody, Counterline, Atmosphere) + optional Live Piano Take.
- General MIDI (GM) Channel 10 is reserved strictly for percussion events.

### 7.2 Voice Cleanup & Stuck-Note Immunity
- Preview player changes, section jumps, track mutes, and MIDI device disconnects MUST immediately send synthetic Note-Off or CC 123 (All Notes Off) commands to clear active sound synthesis voices.

---

## 8. Encoding & Quality Compliance

### 8.1 Clean UTF-8 Encoding
- Source files (`index.html`, `styles.css`, `src/**/*.js`) MUST NOT contain malformed UTF-8 characters or mojibake representations.

### 8.2 Resource & CPU Efficiency
- All Web Audio nodes, synthesis timers, and rendering loops MUST enter a suspended state when playback pauses or when the document becomes hidden.

