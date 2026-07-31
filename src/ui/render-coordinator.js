export function createRenderCoordinator(regions = {}) {
  const entries = new Map(Object.entries(regions).filter(([, render]) => typeof render === "function"));
  const counts = Object.fromEntries([...entries.keys()].map((name) => [name, 0]));
  let cycles = 0;

  function normalizeRequested(requested) {
    const flattened = requested.flat(Infinity).filter(Boolean);
    const names = flattened.includes("*") || flattened.length === 0
      ? [...entries.keys()]
      : flattened;
    return [...new Set(names)].filter((name) => entries.has(name));
  }

  function render(...requested) {
    const names = normalizeRequested(requested);
    cycles += 1;
    for (const name of names) {
      counts[name] += 1;
      entries.get(name)();
    }
    return names;
  }

  function snapshot() {
    return Object.freeze({
      cycles,
      counts: Object.freeze({ ...counts }),
    });
  }

  function resetMetrics() {
    cycles = 0;
    for (const name of entries.keys()) counts[name] = 0;
  }

  return Object.freeze({
    render,
    renderAll: () => render("*"),
    snapshot,
    resetMetrics,
    regions: Object.freeze([...entries.keys()]),
  });
}
