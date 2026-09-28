export function ensurePerformancePromotionControls(dialog) {
  if (!dialog || dialog.querySelector("#performanceAbLab")) return;
  const lab = document.createElement("section");
  lab.className = "performance-ab-lab";
  lab.id = "performanceAbLab";
  lab.setAttribute("aria-label", "Performance A/B promotion");
  lab.innerHTML = '<div class="performance-ab-copy"><small>PERFORMANCE A/B</small><strong>Current vs Performance Engine v1</strong><p id="performanceAbStatus">A current · B preview-only · nothing committed</p></div><div class="performance-ab-actions" role="group" aria-label="Performance A/B actions"><button class="small-button" id="performanceAbCurrent" type="button">A · Current</button><button class="small-button" id="performanceAbPerformed" type="button">B · Performance</button><button class="small-button" id="performanceAbValidate" type="button">Validate B</button><button class="small-button" id="performanceAbAccept" type="button" disabled>Accept B</button><button class="small-button" id="performanceAbReject" type="button" disabled>Reject B</button><button class="small-button" id="performanceAbEnd" type="button">End A/B</button></div>';
  dialog.querySelector(".debugger-raw")?.before(lab);
}
