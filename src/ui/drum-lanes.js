const LANES = Object.freeze([
  { id: "kick", label: "Kick", pitches: [35, 36], color: "#ff927e" },
  { id: "snare", label: "Snare", pitches: [37, 38, 40], color: "#f5c76c" },
  { id: "clap", label: "Clap", pitches: [39], color: "#eea5cb" },
  { id: "hats", label: "Hats", pitches: [42, 44, 46], color: "#77dac8" },
  { id: "other", label: "Other", pitches: [], color: "#96bdf4" },
]);

/** Read-only sixteenth-grid overview; never snaps or changes the source notes. */
export function drumLaneOverview(notes = [], { start = 0, beatsPerBar = 4 } = {}) {
  const origin = Number.isFinite(Number(start)) ? Number(start) : 0;
  const beats = Math.min(8, Math.max(1, Number(beatsPerBar) || 4));
  const steps = Math.round(beats * 4);
  const lanes = LANES.map(lane => ({ ...lane, hits: 0,
    cells: Array.from({ length: steps }, () => ({ hits: 0, velocity: 0 })) }));
  for (const note of Array.isArray(notes) ? notes : []) {
    const pitch = Number(note?.pitch), time = Number(note?.start), velocity = Number(note?.velocity);
    if (![pitch, time, velocity].every(Number.isFinite) || pitch < 0 || pitch > 127 || velocity <= 0) continue;
    if (time < origin || time >= origin + beats) continue;
    const lane = lanes.find(item => item.pitches.includes(Math.round(pitch))) || lanes.at(-1);
    const index = Math.max(0, Math.min(steps - 1, Math.round((time - origin) * 4)));
    const cell = lane.cells[index];
    lane.hits += 1;
    cell.hits += 1;
    cell.velocity = Math.max(cell.velocity, Math.min(127, Math.round(velocity)));
  }
  return { steps, lanes };
}

export function renderDrumLaneOverview(view, { bar = 1 } = {}) {
  const barNumber = Math.max(1, Math.round(Number(bar) || 1));
  return `<header><span><small>DRUM POCKET</small><strong>See the groove</strong></span><b>Bar ${barNumber} · 1/16 snapshot</b></header>
    <div class="rhythm-lane-scroll">${view.lanes.map(lane => `<div class="rhythm-lane" role="img" aria-label="${lane.label}: ${lane.hits} hits in bar ${barNumber}" style="--lane-color:${lane.color}">
      <span class="rhythm-lane-name">${lane.label}<small>${lane.hits} hits</small></span>
      <div class="rhythm-steps" aria-hidden="true" style="--lane-steps:${view.steps}">${lane.cells.map((cell, index) => `<span class="rhythm-step${cell.hits ? " has-hit" : ""}" data-hits="${cell.hits}" style="--hit-strength:${Math.max(0.24, cell.velocity / 127).toFixed(3)}" title="Step ${index + 1}: ${cell.hits} hits${cell.hits ? `, velocity ${cell.velocity}` : ""}"></span>`).join("")}</div>
    </div>`).join("")}</div><p>Read-only. Edit notes in the piano roll. Under See all changes, try Shift Hats or Shape Hat Accents before keeping a change.</p>`;
}
