(() => {
  const API = "http://localhost:8000";

  // ── DOM refs ──
  const $ = (s) => document.querySelector(s);
  const setupScreen   = $("#setupScreen");
  const mainScreen    = $("#mainScreen");
  const setupToken    = $("#setupTokenInput");
  const setupSave     = $("#setupSaveBtn");
  const setupError    = $("#setupError");
  const changeTokenBtn = $("#changeTokenBtn");
  const statusDot     = $("#statusDot");
  const inputEl       = $("#input");
  const outputEl      = $("#output");
  const generateBtn   = $("#generateBtn");
  const clearBtn      = $("#clearBtn");
  const copyBtn       = $("#copyBtn");
  const exportBtn     = $("#exportBtn");
  const scoreBtn      = $("#scoreBtn");
  const scoreSection  = $("#scoreSection");
  const scoreFill     = $("#scoreFill");
  const scoreValue    = $("#scoreValue");
  const templateChips = $("#templateChips");
  const toast         = $("#toast");

  let currentTemplate = null;

  // ── Screen navigation ──
  function showScreen(name) {
    setupScreen.classList.toggle("active", name === "setup");
    mainScreen.classList.toggle("active", name === "main");
    changeTokenBtn.style.display = name === "main" ? "" : "none";
  }

  // ── Toast ──
  function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => { toast.className = "toast"; }, 2200);
  }

  // ── Health check ──
  async function checkHealth() {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
      statusDot.classList.toggle("on", r.ok);
      return r.ok;
    } catch {
      statusDot.classList.remove("on");
      return false;
    }
  }

  // ── Init: decide which screen to show ──
  async function init() {
    const alive = await checkHealth();
    if (!alive) {
      showScreen("setup");
      setupError.textContent = "Backend not reachable — start the server first.";
      return;
    }
    try {
      const r = await fetch(`${API}/settings`);
      const data = await r.json();
      // If a token is configured on the backend, go straight to main screen
      if (data.hf_api_token_set) {
        showScreen("main");
        loadTemplates();
      } else {
        showScreen("setup");
      }
    } catch {
      showScreen("setup");
    }
  }

  // ── Save token ──
  async function saveToken() {
    const token = setupToken.value.trim();
    if (!token) { setupError.textContent = "Please paste your HuggingFace token."; return; }
    if (!token.startsWith("hf_")) { setupError.textContent = "Token should start with hf_"; return; }

    setupError.textContent = "";
    setupSave.disabled = true;
    setupSave.innerHTML = '<span class="spinner"></span>Connecting…';

    try {
      const r = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hf_api_token: token }),
      });
      if (!r.ok) throw new Error("Server error");
      showToast("Token saved — connected!");
      showScreen("main");
      loadTemplates();
    } catch (e) {
      setupError.textContent = "Failed to save token. Is the backend running?";
    } finally {
      setupSave.disabled = false;
      setupSave.textContent = "Connect & Start";
    }
  }

  // ── Templates ──
  async function loadTemplates() {
    try {
      const r = await fetch(`${API}/templates`);
      const data = await r.json();
      templateChips.innerHTML = "";
      Object.keys(data.templates).forEach((key) => {
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.textContent = key.replace(/_/g, " ");
        chip.onclick = () => {
          document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          currentTemplate = key;
          inputEl.value = data.templates[key];
          inputEl.focus();
        };
        templateChips.appendChild(chip);
      });
    } catch { /* silent */ }
  }

  // ── Generate ──
  async function generate() {
    const text = inputEl.value.trim();
    if (!text) { showToast("Enter a prompt first", true); return; }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span>Generating…';
    outputEl.value = "";
    scoreSection.classList.remove("visible");

    try {
      const body = { prompt: text };
      if (currentTemplate) body.template = currentTemplate;
      const r = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Error");
      outputEl.value = data.structured_prompt;
    } catch (e) {
      showToast(e.message || "Generation failed", true);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate";
    }
  }

  // ── Copy ──
  async function copyOutput() {
    const text = outputEl.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied!");
    } catch {
      showToast("Copy failed", true);
    }
  }

  // ── Export ──
  function exportOutput() {
    const text = outputEl.value;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "optimized_prompt.txt"; a.click();
    URL.revokeObjectURL(url);
    showToast("Exported!");
  }

  // ── Score ──
  async function scorePrompt() {
    const text = outputEl.value;
    if (!text) { showToast("Generate first", true); return; }
    try {
      const r = await fetch(`${API}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await r.json();
      const s = data.score ?? 0;
      scoreSection.classList.add("visible");
      scoreFill.style.width = s + "%";
      scoreFill.style.background = s >= 70 ? "#22c55e" : s >= 40 ? "#eab308" : "#ef4444";
      scoreValue.textContent = s;
    } catch {
      showToast("Scoring failed", true);
    }
  }

  // ── Event listeners ──
  setupSave.addEventListener("click", saveToken);
  setupToken.addEventListener("keydown", (e) => { if (e.key === "Enter") saveToken(); });
  changeTokenBtn.addEventListener("click", () => {
    setupToken.value = "";
    setupError.textContent = "";
    showScreen("setup");
  });
  generateBtn.addEventListener("click", generate);
  clearBtn.addEventListener("click", () => { inputEl.value = ""; outputEl.value = ""; scoreSection.classList.remove("visible"); });
  copyBtn.addEventListener("click", copyOutput);
  exportBtn.addEventListener("click", exportOutput);
  scoreBtn.addEventListener("click", scorePrompt);
  inputEl.addEventListener("keydown", (e) => { if (e.ctrlKey && e.key === "Enter") generate(); });

  // Health poll
  setInterval(checkHealth, 15000);

  // Go!
  init();
})();
