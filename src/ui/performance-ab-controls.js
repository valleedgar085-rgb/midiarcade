export function ensurePerformanceAbControls(dialog) {
  if (!dialog || dialog.querySelector("#performanceAbLab")) return;

  const lab = document.createElement("section");
  lab.className = "performance-ab-lab";
  lab.id = "performanceAbLab";

  const copy = document.createElement("div");
  copy.className = "performance-ab-copy";

  const eyebrow = document.createElement("small");
  eyebrow.textContent = "PERFORMANCE A/B";

  const title = document.createElement("strong");
  title.textContent = "Compare current timing against Performance Engine v1";

  const status = document.createElement("p");
  status.id = "performanceAbStatus";
  status.textContent = "A = current canonical song · B = preview-only performed copy · nothing is committed.";
  copy.append(eyebrow, title, status);

  const actions = document.createElement("div");
  actions.className = "performance-ab-actions";
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-label", "Performance A/B audition");

  const current = document.createElement("button");
  current.className = "small-button";
  current.id = "performanceAbCurrent";
  current.type = "button";
  current.textContent = "A · Current";

  const performed = document.createElement("button");
  performed.className = "small-button";
  performed.id = "performanceAbPerformed";
  performed.type = "button";
  performed.textContent = "B · Performance";

  const end = document.createElement("button");
  end.className = "small-button";
  end.id = "performanceAbEnd";
  end.type = "button";
  end.textContent = "End A/B";

  actions.append(current, performed, end);
  lab.append(copy, actions);
  dialog.querySelector(".debugger-raw")?.before(lab);
}
