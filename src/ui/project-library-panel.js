// A small project shelf in Finish. No global navigation or generation changes.
export function installProjectLibraryPanel(root, {
  list, save, open, remove, navigateToFinish = () => {},
} = {}) {
  const doc = root?.ownerDocument ?? root;
  const host = doc?.querySelector?.("#tab-finish .finish-copy");
  if (!host || doc.getElementById("projectLibraryPanel")) return null;

  const style = doc.createElement("style");
  style.id = "projectLibraryStyles";
  style.textContent = `
    .project-library{margin-top:15px;padding:15px;border:1.5px solid #446a79;border-radius:17px;background:linear-gradient(130deg,#17222e,#10141e);display:grid;gap:12px}
    .project-library header{display:grid;gap:3px}.project-library header small{font-size:10px;letter-spacing:.12em;color:#8edee0}
    .project-library header strong{font-size:17px}.project-library header p{font-size:12px;color:#b7c3ce}
    .project-library-save{display:flex;gap:8px;flex-wrap:wrap}.project-library-save label{flex:1 1 160px;display:grid;gap:5px;font-size:11px;color:#c9d6dc}
    .project-library input{min-width:0;width:100%;min-height:44px;border:1px solid #4a7380;border-radius:10px;padding:0 11px;background:#141d28;color:white}
    .project-library button{min-height:44px;border-radius:10px;border:1px solid #598b98;background:#1c3947;color:#f3ffff;padding:9px 13px;cursor:pointer;font-weight:700}
    .project-library button:focus-visible,.project-library input:focus-visible{outline:2px solid #90e2e7;outline-offset:2px}
    .project-library button:disabled{opacity:.55;cursor:not-allowed}
    .project-library .project-library-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .project-library .project-library-list{display:grid;gap:7px}.project-library .project-library-item{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid #3d5661;border-radius:12px}
    .project-library .project-library-copy{flex:1 1 140px;min-width:0;display:grid;gap:2px;overflow-wrap:anywhere}
    .project-library .project-library-copy small{color:#a6bdc7}.project-library .project-library-item .project-library-actions{display:flex;gap:6px;flex-wrap:wrap}
    .project-library .project-library-delete{border-color:#8c5566;background:#301d27}
    .project-library #projectLibraryStatus{font-size:11px;color:#b4cbd2}
    @media(max-width:650px){.project-library{padding:11px}.project-library-save button{flex:1 1 100%}.project-library .project-library-actions{width:100%}.project-library .project-library-actions button{flex:1}}
  `;
  doc.head?.append(style);

  const panel = doc.createElement("section");
  panel.className = "project-library";
  panel.id = "projectLibraryPanel";
  panel.setAttribute("aria-labelledby", "projectLibraryTitle");
  panel.innerHTML = `
    <header><small>ON-DEVICE SONG PROJECTS</small><strong id="projectLibraryTitle">Save and reopen ideas</strong>
      <p>Projects stay on this device. Export a MIDI file separately for DAW use; clearing app data may erase local projects.</p></header>
    <div class="project-library-save"><label>PROJECT NAME
      <input id="projectLibraryName" maxlength="72" autocomplete="off" placeholder="Name this song idea" /></label>
      <button type="button" id="projectLibrarySave">Save a copy</button></div>
    <div class="project-library-toolbar"><strong>Saved ideas</strong><button type="button" id="projectLibraryRefresh">Refresh</button></div>
    <div class="project-library-list" id="projectLibraryList" role="list"></div>
    <p id="projectLibraryStatus" role="status" aria-live="polite">Select Refresh to view your device projects.</p>`;
  host.append(panel);
  const input = panel.querySelector("#projectLibraryName");
  const listHost = panel.querySelector("#projectLibraryList");
  const status = panel.querySelector("#projectLibraryStatus");
  const saveButton = panel.querySelector("#projectLibrarySave");
  const refreshButton = panel.querySelector("#projectLibraryRefresh");
  let busy = false;

  function setStatus(value) { status.textContent = value; }
  async function run(action) {
    if (busy) return;
    busy = true;
    saveButton.disabled = true;
    refreshButton.disabled = true;
    listHost.querySelectorAll("button").forEach((item) => { item.disabled = true; });
    try { await action(); }
    catch (error) { setStatus(error?.message ?? "Project operation failed. Current song is safe."); }
    finally {
      busy = false;
      saveButton.disabled = false;
      refreshButton.disabled = false;
      listHost.querySelectorAll("button").forEach((item) => {
        item.disabled = item.dataset.valid === "false";
      });
    }
  }
  async function refresh() {
    const entries = await list();
    const cards = entries.map((item) => {
      const row = doc.createElement("div");
      row.className = "project-library-item";
      row.setAttribute("role", "listitem");
      const copy = doc.createElement("span");
      copy.className = "project-library-copy";
      const title = doc.createElement("strong");
      title.textContent = item.name;
      const meta = doc.createElement("small");
      meta.textContent = (item.valid ? "Saved " : "Damaged · remove only · ") + new Date(item.savedAt).toLocaleString();
      copy.append(title, meta);
      const actions = doc.createElement("span");
      actions.className = "project-library-actions";
      const openButton = doc.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.dataset.valid = String(item.valid);
      openButton.disabled = !item.valid;
      openButton.setAttribute("aria-label", `Open project ${item.name}`);
      openButton.addEventListener("click", () => run(async () => {
        if (await open(item.id)) {
          setStatus(`Opened "${item.name}". Previous song can be restored with Undo.`);
        } else setStatus("Open canceled. Current song unchanged.");
      }));
      const removeButton = doc.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Delete";
      removeButton.className = "project-library-delete";
      removeButton.setAttribute("aria-label", `Delete project ${item.name}`);
      removeButton.addEventListener("click", () => run(async () => {
        if (!doc.defaultView?.confirm?.(`Delete saved project "${item.name}"? This cannot be undone.`)) return;
        await remove(item.id);
        await refresh();
        setStatus("Saved project deleted. The current song was not changed.");
      }));
      actions.append(openButton, removeButton);
      row.append(copy, actions);
      return row;
    });
    listHost.replaceChildren(...cards);
    if (!entries.length) setStatus("No saved projects yet. Name your song and tap Save a copy.");
    return entries;
  }
  saveButton.addEventListener("click", () => run(async () => {
    await save(input.value);
    await refresh();
    setStatus("Song copied to this device. It will not replace your current song.");
  }));
  refreshButton.addEventListener("click", () => run(refresh));

  const menuExport = doc.getElementById("menuItemExport");
  if (menuExport && !doc.getElementById("menuItemProjects")) {
    const shortcut = doc.createElement("button");
    shortcut.id = "menuItemProjects";
    shortcut.type = "button";
    shortcut.className = "menu-item";
    shortcut.textContent = "▣  Save / Open Projects";
    menuExport.insertAdjacentElement("afterend", shortcut);
    shortcut.addEventListener("click", () => {
      navigateToFinish();
      void run(refresh);
      panel.scrollIntoView?.({ block: "nearest" });
    });
  }
  doc.querySelector('[data-workspace="finish"]')?.addEventListener("click", () => { void run(refresh); });
  return Object.freeze({ refresh: () => run(refresh), panel });
}
