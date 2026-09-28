export function ensurePerformanceAbControls(dialog) {
  if (!dialog || dialog.querySelector("#performanceAbLab")) return;
  const lab = document.createElement("section");
  lab.id = "performanceAbLab";
  lab.className = "performance-ab-lab";
  lab.innerHTML = '<div class="performance-ab-copy"><small>PERFORMANCE A/B</small><strong>Current vs Performance Engine v1</strong><p id="performanceAbStatus">A = current song · B = preview-only performance · nothing committed.</p></div><div class="performance-ab-actions" role="group" aria-label="Performance A/B audition"><button class="small-button" id="performanceAbCurrent" type="button">A · Current</button><button class="small-button" id="performanceAbPerformed" type="button">B · Performance</button><button class="small-button" id="performanceAbEnd" type="button">End A/B</button></div>';
  dialog.querySelector(".debugger-raw")?.before(lab);
}
