const DEFAULT_WORKSPACES = ["create", "arrange", "mix", "finish"];

export function createWorkspaceController({
  root = document,
  workspaces = DEFAULT_WORKSPACES,
  initialWorkspace = workspaces[0],
  onChange = () => {},
} = {}) {
  const allowed = new Set(workspaces);
  let activeWorkspace = allowed.has(initialWorkspace) ? initialWorkspace : workspaces[0];
  let bound = false;

  function elements() {
    return {
      buttons: [...(root.querySelectorAll?.("[data-workspace]") ?? [])],
      panels: [...(root.querySelectorAll?.("[data-workspace-panel]") ?? [])],
    };
  }

  function activate(workspace, { focus = false, notify = true } = {}) {
    if (!allowed.has(workspace)) return false;
    const previous = activeWorkspace;
    activeWorkspace = workspace;
    const { buttons, panels } = elements();
    for (const button of buttons) {
      const active = button.dataset.workspace === workspace;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (focus && active) button.focus?.();
    }
    for (const panel of panels) {
      const active = panel.dataset.workspacePanel === workspace;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    }
    if (notify && (previous !== workspace || !bound)) onChange(workspace, previous);
    return true;
  }

  function bind() {
    if (bound) return;
    bound = true;
    const { buttons } = elements();
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => activate(button.dataset.workspace));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = Math.max(0, buttons.indexOf(button));
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        activate(buttons[nextIndex]?.dataset.workspace, { focus: true });
      });
      button.tabIndex = index === 0 ? 0 : -1;
    });
    activate(activeWorkspace, { notify: true });
  }

  return Object.freeze({
    bind,
    activate,
    get activeWorkspace() {
      return activeWorkspace;
    },
  });
}
