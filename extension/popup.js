/**
 * popup.js — Chrome Extension popup logic for Prompt Maker.
 *
 * Connects to the local FastAPI backend (http://127.0.0.1:8000)
 * and provides the same generate / copy / export / score workflow
 * in a compact popup window.
 */

const API_BASE = "http://127.0.0.1:8000";

// ── State ─────────────────────────────────────────────────────────────
let selectedTemplate = null;

// ── DOM refs ──────────────────────────────────────────────────────────
const input       = document.getElementById("input");
const output      = document.getElementById("output");
const generateBtn = document.getElementById("generateBtn");
const clearBtn    = document.getElementById("clearBtn");
const copyBtn     = document.getElementById("copyBtn");
const exportBtn   = document.getElementById("exportBtn");
const scoreBtn    = document.getElementById("scoreBtn");
const toastEl     = document.getElementById("toast");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");
const chipsBox    = document.getElementById("templateChips");
const scoreSection = document.getElementById("scoreSection");
const scoreFill   = document.getElementById("scoreFill");
const scoreValue  = document.getElementById("scoreValue");

// ── Health check ──────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (res.ok) {
      statusDot.classList.add("online");
      statusText.textContent = "online";
    }
  } catch {
    statusDot.classList.remove("online");
    statusText.textContent = "offline";
  }
}

// ── Load template chips ───────────────────────────────────────────────
async function loadTemplates() {
  try {
    const res = await fetch(`${API_BASE}/templates`);
    const data = await res.json();
    for (const [key, desc] of Object.entries(data.templates)) {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = key.replace("_", " ");
      chip.title = desc;
      chip.addEventListener("click", () => toggleTemplate(chip, key));
      chipsBox.appendChild(chip);
    }
  } catch { /* server may be down — chips just won't show */ }
}

function toggleTemplate(chip, key) {
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  if (selectedTemplate === key) {
    selectedTemplate = null;
  } else {
    selectedTemplate = key;
    chip.classList.add("active");
  }
}

// ── Generate ──────────────────────────────────────────────────────────
async function generate() {
  const text = input.value.trim();
  if (!text) { showToast("Enter a prompt first.", true); return; }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="spinner"></span>Working…';
  scoreSection.classList.remove("visible");

  try {
    const body = { prompt: text };
    if (selectedTemplate) body.template = selectedTemplate;

    const res = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    output.value = data.structured_prompt;
    showToast("Prompt generated!");
  } catch (e) {
    showToast(e.message, true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
}

// ── Copy ──────────────────────────────────────────────────────────────
async function copyOutput() {
  const text = output.value;
  if (!text) { showToast("Nothing to copy.", true); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied!");
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied!");
  }
}

// ── Export ─────────────────────────────────────────────────────────────
function exportPrompt() {
  const text = output.value;
  if (!text) { showToast("Nothing to export.", true); return; }
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "optimized_prompt.txt";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported!");
}

// ── Score ─────────────────────────────────────────────────────────────
async function scoreOutput() {
  const text = output.value;
  if (!text) { showToast("Generate a prompt first.", true); return; }

  try {
    const res = await fetch(`${API_BASE}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    const data = await res.json();
    const score = data.score;

    scoreValue.textContent = score;
    scoreFill.style.width = score + "%";

    if (score >= 70)      scoreFill.style.background = "var(--green)";
    else if (score >= 40) scoreFill.style.background = "#eab308";
    else                  scoreFill.style.background = "var(--red)";

    scoreSection.classList.add("visible");
  } catch {
    showToast("Scoring failed.", true);
  }
}

// ── Clear ─────────────────────────────────────────────────────────────
function clearAll() {
  input.value  = "";
  output.value = "";
  scoreSection.classList.remove("visible");
  selectedTemplate = null;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
}

// ── Toast helper ──────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => { toastEl.className = "toast"; }, 2200);
}

// ── Event listeners ───────────────────────────────────────────────────
generateBtn.addEventListener("click", generate);
clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copyOutput);
exportBtn.addEventListener("click", exportPrompt);
scoreBtn.addEventListener("click", scoreOutput);

input.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") generate();
});

// ── Init ──────────────────────────────────────────────────────────────
checkHealth();
loadTemplates();
