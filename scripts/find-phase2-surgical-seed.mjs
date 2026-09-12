import { generateNew } from "../src/music-engine.js";

const genres = ["jazz", "techno", "hipHop", "trap", "drill", "house", "rnbSoul", "neoSoul"];
const profiles = [
  { bars: 8, energy: 0.05, complexity: 0.05 },
  { bars: 8, energy: 0.2, complexity: 0.25 },
  { bars: 16, energy: 0.25, complexity: 0.3 },
];

for (const profile of profiles) {
  for (const genre of genres) {
    for (let index = 0; index < 36; index += 1) {
      const input = {
        seed: `surgical-accept-${genre}-${profile.bars}-${index}`,
        genre,
        ...profile,
      };
      const song = generateNew(input);
      const repair = song.meta?.scoreDetails?.criticRepair;
      if (repair?.selectedFromRepair && song.criticRepair?.mode === "surgical-window") {
        console.log("SURGICAL_ACCEPTED_SEED", JSON.stringify({
          input,
          group: song.criticRepair.group,
          dimension: song.criticRepair.weakestDimension,
          window: song.criticRepair.surgicalWindow,
          acceptance: song.criticRepair.acceptance,
          repairSummary: repair,
        }));
        process.exit(0);
      }
    }
  }
}

console.log("SURGICAL_ACCEPTED_SEED none found");
process.exit(2);
