/**
 * arrangement-engine.js
 *
 * Builds complete songs or individual song sections
 * using the existing MidiArcade engine.
 */

import {
    createSongDNA,
    buildSongArrangement
} from "./song-dna.js";

export const GENERATION_MODE = Object.freeze({

    FULL_SONG: "fullSong",

    SECTION: "section"

});

export class ArrangementEngine {

    constructor(engine){

        this.engine = engine;

    }

    /**
     * Generate an entire song
     */

    generateSong(options){

        const dna = createSongDNA({

            genre: options.genre,
            bpm: options.bpm,
            key: options.key,
            scale: options.scale,
            progression: options.progression,
            seed: options.seed

        });

        const arrangement =
            buildSongArrangement(options.genre);

        let cursor = 0;

        const sections = [];

        for(const section of arrangement){

            const generated =
                this.generateSection({

                    dna,

                    type: section.type,

                    bars: section.bars,

                    energy: section.energy,

                    startBar: cursor

                });

            sections.push(generated);

            cursor += section.bars;

        }

        return {

            dna,

            bpm: dna.bpm,

            key: dna.key,

            scale: dna.scale,

            genre: dna.genre,

            totalBars: cursor,

            sections

        };

    }

    /**
     * Generate ONE section only
     */

    generateSection({

        dna,

        type,

        bars,

        energy,

        startBar = 0

    }){

        const settings =
            this.getSectionSettings(type,energy);

        return {

            type,

            startBar,

            bars,

            energy,

            tracks:{

                drums:
                    this.engine.generateDrums({

                        ...settings,
                        dna,
                        bars

                    }),

                bass:
                    this.engine.generateBass({

                        ...settings,
                        dna,
                        bars

                    }),

                chords:
                    this.engine.generateChords({

                        ...settings,
                        dna,
                        bars

                    }),

                melody:
                    this.engine.generateMelody({

                        ...settings,
                        dna,
                        bars

                    }),

                counterpoint:
                    this.engine.generateCounterpoint({

                        ...settings,
                        dna,
                        bars

                    }),

                pad:
                    this.engine.generatePad({

                        ...settings,
                        dna,
                        bars

                    })

            }

        };

    }

    /**
     * Different musical behavior
     * for every section.
     */

    getSectionSettings(type,energy){

        switch(type){

            case "intro":

                return{

                    density:.30,

                    variation:.18,

                    fills:false,

                    hook:false,

                    energy

                };

            case "verse":

                return{

                    density:.55,

                    variation:.35,

                    fills:true,

                    hook:false,

                    energy

                };

            case "preChorus":

                return{

                    density:.72,

                    variation:.52,

                    fills:true,

                    hook:true,

                    energy

                };

            case "chorus":

                return{

                    density:.92,

                    variation:.70,

                    fills:true,

                    hook:true,

                    energy

                };

            case "bridge":

                return{

                    density:.58,

                    variation:.90,

                    fills:true,

                    hook:false,

                    energy

                };

            case "breakdown":

                return{

                    density:.22,

                    variation:.42,

                    fills:false,

                    hook:false,

                    energy

                };

            case "outro":

                return{

                    density:.28,

                    variation:.15,

                    fills:false,

                    hook:false,

                    energy

                };

            default:

                return{

                    density:.50,

                    variation:.40,

                    fills:true,

                    hook:false,

                    energy

                };

        }

    }

}