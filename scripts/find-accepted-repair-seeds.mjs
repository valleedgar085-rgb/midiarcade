import { generateNew } from "../src/music-engine.js";

const cases = [
  { id: "phase40", bars: 16, genre: "jazz", energy: 0.2, complexity: 0.2 },
  { id: "phrase-memory", bars: 8, genre: "jazz", energy: 0.05, complexity: 0.05 },
];

for (const testCase of cases) {
  const matches = [];
  for (let index = 1; index <= 48 && matches.length < 5; index += 1) {
    const seed = `repair-reconcile-${index}`;
    const song = generateNew({ ...testCase, seed });
    const details = song.meta?.scoreDetails ?? {};
    const repair = details.criticRepair ?? {};
    const selected = details.candidateScores?.find((candidate) => candidate.index === details.selectedCandidate);
    if (repair.selectedFromRepair === true && selected?.repairAccepted === true) {
      matches.push({
        seed,
        group: repair.selectedGroup,
        attempts: repair.attempts,
        accepted: repair.accepted,
        rejected: repair.rejected,
        phase: song.generationInterlock?.reconciliation?.phase ?? null,
        totalScore: details.totalScore,
        selectedCandidate: details.selectedCandidate,
        weaknessGain: song.criticRepair?.acceptance?.weaknessGain ?? null,
        acceptanceReasons: song.criticRepair?.acceptance?.reasons ?? [],
      });
    }
  }
  console.log(`REPAIR_SEEDS ${testCase.id} ${JSON.stringify(matches)}`);
  if (!matches.length) process.exitCode = 2;
}
