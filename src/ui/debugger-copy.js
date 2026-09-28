export async function copyGenerationDebuggerReport({ runs, workerActive, toast }) {
  if (!runs.length) return toast("Generate a song first so the debugger has a run to copy.");
  const payload = JSON.stringify({
    app: "MIDI Arcade",
    version: "1.2.3",
    capturedAt: new Date().toISOString(),
    workerActive,
    runs,
  }, null, 2);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = payload;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    toast("Debugger report copied.");
  } catch (error) {
    console.warn("Could not copy debugger report", error);
    toast("Copy failed. Open Raw diagnostic JSON and select it manually.");
  }
}
