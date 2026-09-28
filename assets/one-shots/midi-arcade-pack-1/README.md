# MIDI Arcade Hip-Hop + Trap Pack 1

Runtime target: `assets/one-shots/midi-arcade-pack-1/`

Pack inventory:
- 5 kicks
- 5 snares
- 5 claps
- 2 closed hats
- 2 open hats
- 1 dedicated trap-roll accent
- 5 tuned 808s

Playback rules:
- Normal closed/open hat notes use single-hit hat samples.
- `hatAccent` is reserved for notes explicitly marked as a roll.
- Tuned 808 roots use A1=33, B1=35, C2=36, E2=40 and are pitch-shifted to the requested bass note.
- If any WAV is absent or fails to decode, preview playback falls back to MIDI Arcade's existing procedural drum/bass voice rather than failing.

The source pack has been validated as 44.1 kHz WAV audio and the exact file mapping is stored in `manifest.json`.
