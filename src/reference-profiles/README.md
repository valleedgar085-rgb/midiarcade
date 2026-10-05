# MIDI Arcade reference profiles

Reference profiles are small musical-statistics files derived from a group of user-supplied reference tracks.

They intentionally do **not** contain audio, melodies, chord progressions, or copied note sequences.

## Profile shape

```js
{
  version: 1,
  id: "hiphop-user-library-v1",
  genre: "hipHop",
  sourceCount: 12,
  confidence: 0.9,
  traits: {
    syncopation: 0.68,
    swing: 0.24,
    humanize: 0.3,
    phraseBars: 4,
    density: 0.55,
    bassActivity: 0.78,
    bassLock: 0.84,
    melodySpace: 0.76,
    supportRestraint: 0.72,
    introRestraint: 0.88,
    payoffLift: 0.84,
    transitionBreath: 0.7
  },
  stylePreferences: {
    drumGroove: { backbeat: 0.9, halfTime: 0.5 },
    bassGroove: { syncopated: 0.9, rootFifth: 0.45 },
    chordMotion: { sustained: 0.8, offbeat: 0.4 }
  }
}
```

All scalar traits are normalized to 0..1. Reference influence is capped by the engine and explicit user controls always remain authoritative.

Generated profiles are registered in `src/reference-profiles/index.js`.
