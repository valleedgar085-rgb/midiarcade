# MIDI Arcade Hip-Hop + Trap Pack 1

This directory is the runtime home for the user-provided one-shot pack.

The app reads `manifest.json` and preloads any listed WAV files before preview playback. If a file is absent, invalid, or fails to decode, MIDI Arcade automatically uses the existing procedural preview voice instead.

Expected manifest roles:

- kick
- snare
- clap
- hat
- openHat
- cymbal
- tom
- bass808

Each role accepts either a string path or an object such as:

```json
{ "path": "808s/808-c.wav", "rootMidi": 36, "gain": 0.9 }
```

The uploaded Pack 1 ZIP still needs to be reattached so its exact WAV filenames can be copied here and entered in the manifest.
