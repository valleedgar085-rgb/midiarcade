import { finalizeGeneratedSong } from "./generation-finalizer.js";

export function createGenerationRunner({
  generateNew,
  generateSimilar,
  validate = (song) => Boolean(song),
  recorder = null,
} = {}) {
  if (typeof generateNew !== "function" || typeof generateSimilar !== "function") {
    throw new TypeError("generation runner requires New and Similar generators");
  }

  let running = false;

  return Object.freeze({
    get running() {
      return running;
    },
    async generate(kind, { sourceSong = null, config = {} } = {}) {
      if (running) return { status: "busy", song: null };
      if (!["new", "similar"].includes(kind)) throw new TypeError(`Unknown generation kind: ${kind}`);
      if (kind === "similar" && !sourceSong) throw new TypeError("Similar generation requires a source song");

      running = true;
      const flightId = typeof recorder?.begin === "function"
        ? recorder.begin(kind, { sourceSong, config })
        : null;
      recorder?.mark?.(flightId, "plan", {
        producerBrain: config?.producerBrain?.id ?? null,
        blueprint: config?.producerBrain?.blueprint?.id ?? null,
      });

      try {
        recorder?.mark?.(flightId, "compose");
        const generated = await Promise.resolve(
          kind === "new"
            ? generateNew(config)
            : generateSimilar(sourceSong, config),
        );
        const finalized = finalizeGeneratedSong(generated, { kind, sourceSong, config });
        const song = finalized.song;
        recorder?.mark?.(flightId, "diagnose", {
          candidateSearch: Boolean(song?.meta?.scoreDetails?.candidateSearch),
          snareBounce: finalized.diagnostics.snareBounce,
          sectionDrumEvolution: finalized.diagnostics.sectionDrumEvolution,
        });
        if (!validate(song)) throw new Error("The composition engine returned an incomplete song.");
        recorder?.mark?.(flightId, "finalize");
        recorder?.complete?.(flightId, song);
        return { status: "committed", song };
      } catch (error) {
        recorder?.fail?.(flightId, error);
        throw error;
      } finally {
        running = false;
      }
    },
  });
}
