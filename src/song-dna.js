/**
 * song-dna.js
 * MidiArcade v2
 *
 * Creates one musical identity that every generator shares.
 */

export const SECTION_TYPES = Object.freeze({
  INTRO: "intro",
  VERSE: "verse",
  PRECHORUS: "preChorus",
  CHORUS: "chorus",
  BRIDGE: "bridge",
  BREAKDOWN: "breakdown",
  SOLO: "solo",
  OUTRO: "outro"
});

export const DEFAULT_ARRANGEMENTS = Object.freeze({

  pop: [
    "intro",
    "verse",
    "preChorus",
    "chorus",
    "verse",
    "chorus",
    "bridge",
    "chorus",
    "outro"
  ],

  hipHop: [
    "intro",
    "verse",
    "hook",
    "verse",
    "hook",
    "bridge",
    "hook",
    "outro"
  ],

  trap: [
    "intro",
    "verse",
    "hook",
    "verse",
    "hook",
    "outro"
  ],

  house: [
    "intro",
    "build",
    "drop",
    "break",
    "drop",
    "outro"
  ],

  techno: [
    "intro",
    "groove",
    "build",
    "drop",
    "break",
    "drop",
    "outro"
  ]

});

export function createSongDNA({

    genre,
    bpm,
    key,
    scale,
    seed,
    progression

}) {

    return {

        id: crypto.randomUUID(),

        genre,

        bpm,

        key,

        scale,

        seed,

        progression,

        motifA: null,

        motifB: null,

        grooveSeed: seed * 3,

        melodySeed: seed * 5,

        rhythmSeed: seed * 7,

        harmonySeed: seed * 11,

        energyCurve: [

            0.35,
            0.55,
            0.70,
            1.00,
            0.65,
            1.00,
            0.30

        ],

        created: Date.now()

    };

}

export function sectionEnergy(section){

    switch(section){

        case "intro":
            return .35;

        case "verse":
            return .55;

        case "preChorus":
            return .72;

        case "chorus":
            return 1.00;

        case "bridge":
            return .65;

        case "solo":
            return .82;

        case "breakdown":
            return .45;

        case "outro":
            return .28;

        default:
            return .50;

    }

}

export function sectionBars(section){

    switch(section){

        case "intro":
            return 8;

        case "verse":
            return 16;

        case "preChorus":
            return 8;

        case "chorus":
            return 16;

        case "bridge":
            return 8;

        case "solo":
            return 16;

        case "breakdown":
            return 8;

        case "outro":
            return 8;

        default:
            return 8;

    }

}

export function buildSongArrangement(genre="pop"){

    const form =
        DEFAULT_ARRANGEMENTS[genre] ??
        DEFAULT_ARRANGEMENTS.pop;

    return form.map(section=>({

        type:section,

        bars:sectionBars(section),

        energy:sectionEnergy(section)

    }));

}