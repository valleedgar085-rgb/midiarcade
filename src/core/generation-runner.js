export function createGenerationRunner({
  generateNew,
  generateSimilar,
  validate = (song) => Boolean(song),
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
      try {
        const song = await Promise.resolve(
          kind === "new"
            ? generateNew(config)
            : generateSimilar(sourceSong, config),
        );
        if (!validate(song)) throw new Error("The composition engine returned an incomplete song.");
        return { status: "committed", song };
      } finally {
        running = false;
      }
    },
  });
}
