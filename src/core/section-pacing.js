export function resolveSectionPacing(input = {}) {
  const sectionPacing = input.sectionPacing === "roomier" ? "roomier" : "standard";
  const selected = Number(sectionPacing === "roomier" ? input.pacingBaseBars ?? input.bars : input.bars);
  const pacingBaseBars = Math.min(128, Math.max(1, Math.round(Number.isFinite(selected) ? selected : 32)));
  const bars = sectionPacing === "roomier" && pacingBaseBars >= 8
    ? Math.min(128, Math.ceil((pacingBaseBars * 1.25 + Math.max(4, pacingBaseBars / 8)) / 4) * 4)
    : pacingBaseBars;
  return { sectionPacing, pacingBaseBars, bars };
}

// Add time to the existing form rather than stretching notes or adding sections.
export function roomierSectionSizes(layout, baseline, totalBars) {
  const sizes = [...baseline];
  let extra = Math.max(0, totalBars - sizes.reduce((sum, bars) => sum + bars, 0));
  if (!extra) return sizes;
  const intro = layout.findIndex((section) => section.name === "intro");
  const body = sizes.map((_, index) => index).filter((index) => index !== intro);
  if (intro >= 0) {
    const added = Math.min(Math.max(4, Math.ceil(sizes[intro] * 0.75)), Math.max(0, extra - body.length));
    sizes[intro] += added;
    extra -= added;
  }
  if (!body.length) {
    sizes[0] += extra;
    return sizes;
  }
  // Each other section gets a little room before distributing any remainder.
  for (const index of body) {
    if (!extra) break;
    sizes[index] += 1;
    extra -= 1;
  }
  const weight = body.reduce((sum, index) => sum + baseline[index], 0);
  const exact = body.map((index) => ({ index, value: extra * baseline[index] / weight }));
  for (const item of exact) sizes[item.index] += Math.floor(item.value);
  const remainder = extra - exact.reduce((sum, item) => sum + Math.floor(item.value), 0);
  const order = exact.sort((a, b) => (b.value % 1) - (a.value % 1) || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) sizes[order[index].index] += 1;
  return sizes;
}

export function roomierIntroEntryBars(trackId, introBars) {
  const delays = { drums: 0, pad: 0, chords: 1, bass: 1.5, melody: 2.5, counterpoint: 3.5 };
  return Math.min(delays[trackId] ?? 0, Math.max(0, introBars * 0.65));
}
