# MIDI Arcade

MIDI Arcade is a local-first Android piano improvisation studio and multitrack MIDI song generator. It turns a musical direction into a structured backing band, gives the player live harmony guidance, captures a piano performance, and exports the band plus the take as an editable Standard MIDI File.

## Flagship loop

1. **Create** — generate a genre-aware arrangement with drums, bass, chords, melody, counterline, and atmosphere.
2. **Jam** — play the multitouch piano, a computer keyboard, Web MIDI, or native Android MIDI/USB input.
3. **Improve** — follow the active and upcoming chord, highlight chord/scale tones, and receive private on-device feedback for pitch fit, chord tones, pocket, and phrasing.
4. **Finish elsewhere** — edit notes in the built-in piano roll, then export one Type-1 `.mid` with six named band tracks and an optional seventh Live Piano Take.

Jam Studio supports sustain-pedal input, hot-plug refresh, stuck-note cleanup, backing-only playback, partial take quantization, practice streaks, and a separate personal-best score. It does not reward playing more notes; simple, well-placed phrases can score as highly as busy ones.

## Composition and editing

The deterministic engine supports Neo Soul / R&B, Hip-Hop, Trap, House, Techno, Drum & Bass, Synthwave, and Pop. Each profile supplies a tempo pocket, modes, groove grammar, chord movement, arrangement shape, human feel, and General MIDI palette.

- **New song idea** creates a new seed, form, harmony, motif, groove, sound palette, and every instrument part.
- **More like this** preserves the idea's musical DNA while composing a related variation.
- **Power, Motion, Bloom, and Hush** rewrite only the selected instrument.
- **Piano roll** tools draw, select, quantize, humanize, nudge, resize, transpose, duplicate, and delete notes with one-step Undo.
- **Human feel** controls expose triplet spice, transition rolls, phrase evolution, surprise, swing, and timing variation.
- **Autosave** restores the latest valid song, live take, settings, score, and practice progress from on-device storage.

Generation uses a deterministic multi-candidate quality search. Phase 20 adds a bounded critic-repair pass: only when the normal pool misses its musical target, the critic identifies the weakest harmony, groove, motif, performance, or arrangement dependency group and tests at most two focused repairs. No generation work runs while the app is idle.

The browser preview uses layered filtered voices, stereo placement, convolution ambience, a tempo-safe delay bus, low-end cleanup, saturation, compression, and generated CC11 expression curves. Exported sound still depends on the receiving DAW or MIDI instrument.

## MIDI input and export

Android uses a small Capacitor bridge over `MidiManager`, so class-compliant USB and native Android MIDI inputs can be discovered without media-library or storage permissions. The web build can use already-authorized Web MIDI devices and requests browser access only after the player presses **Find my keyboard**. Bluetooth LE MIDI (BLE MIDI) is future work and is not supported in the current release.

Export writes a temporary MIDI file to the Android app cache and opens the system save/share sheet. The Type-1 file includes tempo, time signature, corrected modal key signature, section markers, track/instrument names, program changes, volume, pan, expression, reverb, notes, velocities, and channels. Drums use General MIDI channel 10; the live piano take has its own channel and track.

For FL Studio, import the `.mid`, enable **Create one channel per track** and **Set mixer tracks for new channels**, then replace the placeholder General MIDI sounds. See [FL Studio's MIDI import guide](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/automation_midiimport.htm).

## Privacy

The production code has no accounts, ads, analytics, crash SDK, cloud service, microphone access, media-library access, or Internet permission. MIDI messages, songs, scores, and practice data stay on the device unless the user explicitly exports or shares a file. Android backup and device-transfer extraction are disabled for app data.

The source policy is in [docs/PRIVACY.md](docs/PRIVACY.md), with a bundled web version at [privacy-policy.html](privacy-policy.html). The public Google Play URL is [midi-arcade-privacy.edgarvalle520.chatgpt.site](https://midi-arcade-privacy.edgarvalle520.chatgpt.site/).

## Development

Requirements:

- Node.js 22+
- Python available on `PATH` for the simple local server
- Android builds: JDK 21 and Android SDK 36

```powershell
npm install
npm test
npm run build
npm run dev
```

Open `http://localhost:4173` for the development build.

The browser application is split across small state, storage, generation, workspace, rendering, playback, and control-catalog modules under `src/core/` and `src/ui/`. `src/app.js` remains the integration shell; new state-independent behavior should be added to the focused modules and tested directly.

Android commands:

```powershell
npm run android:sync
npm run android:verify
npm run android:bundle
```

`android:bundle` creates the release AAB under `android/app/build/outputs/bundle/release/`. A production upload still requires the developer's private upload keystore and Play App Signing setup; secrets are intentionally not included in this repository.

## Launch material

- [Google Play listing copy and screenshot storyboard](docs/PLAY_STORE_LISTING.md)
- [Quality, closed-test, staged-rollout, retention, and ASO plan](docs/LAUNCH_PLAN.md)
- [Versioned brand assets](assets/brand/)
- [512 px Play icon](assets/store/play-icon-512-v2.png)
- [1024 × 500 Play feature graphic](assets/store/play-feature-graphic-1024x500-v2.png)

A top-10 chart position cannot be guaranteed by code or metadata. The launch plan instead defines measurable product quality, activation, retention, rating, and store-conversion gates that make durable growth possible.
