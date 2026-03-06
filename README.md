# ⚡ Prompt Maker

**Prompt Maker** is a lightweight web app that converts messy, unstructured human prompts into well-structured prompts optimized for large language models.

---

## Architecture

```
Prompt_Maker/
├── backend/
│   ├── __init__.py          # Package marker
│   ├── config.py            # Env-var loading, constants, system prompt
│   ├── prompt_engine.py     # HuggingFace API call + quality scorer
│   └── main.py              # FastAPI application & routes
├── extension/               # Chrome extension (popup UI)
│   ├── manifest.json        # Manifest V3
│   ├── popup.html           # Compact popup interface
│   ├── popup.js             # Popup logic (API calls, copy, export, score)
│   └── icons/               # Extension icons (16/48/128 px)
├── frontend/
│   └── index.html           # Full-page web interface
├── requirements.txt         # Python dependencies
├── .env.example             # Template for environment variables
├── .gitignore
└── README.md
```

### File Responsibilities

| File | Purpose |
|---|---|
| **`backend/config.py`** | Loads configuration from `.env` (via `python-dotenv`). Defines the HuggingFace API URL, system prompt for the model, and generation hyper-parameters. |
| **`backend/prompt_engine.py`** | Contains `generate_structured_prompt()` which sends the user's raw prompt to the HuggingFace Inference API and returns the structured output. Also contains `score_prompt()` (heuristic quality scorer) and `PROMPT_TEMPLATES` (domain presets). |
| **`backend/main.py`** | FastAPI entry point. Registers CORS, mounts the frontend as static files, and exposes the REST endpoints: `POST /generate`, `POST /score`, `GET /templates`, and `GET /health`. |
| **`frontend/index.html`** | Self-contained single-page app with dark-theme UI. Provides an input textarea, template selector chips, generate button, output area, copy/export buttons, and a prompt quality score bar. |
| **`extension/manifest.json`** | Chrome Extension Manifest V3. Declares the popup, icons, and host permissions for the local backend. |
| **`extension/popup.html`** | Compact popup UI styled for the Chrome toolbar — same features as the web UI in a 420 px-wide popup. |
| **`extension/popup.js`** | All popup logic: API calls, template loading, copy/export/score, health-check indicator, and keyboard shortcuts. |

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url> && cd Prompt_Maker
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

### 2. Configure

Copy the example env file and add your HuggingFace token:

```bash
cp .env.example .env
```

Edit `.env`:

```
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxx
```

> Get a token at https://huggingface.co/settings/tokens (a free *read* token is sufficient).

### 3. Run

```bash
python -m backend.main
```

The server starts at **http://127.0.0.1:8000**. Open it in your browser to use the UI, or visit `http://127.0.0.1:8000/docs` for the interactive API docs.

---

## API Reference

### `POST /generate`

Convert a raw prompt into a structured LLM prompt.

**Request:**
```json
{
  "prompt": "explain this research paper simply and tell me the important parts",
  "template": "research"
}
```

**Response:**
```json
{
  "structured_prompt": "You are an expert researcher and teacher.\n\nTask:\nExplain the following research paper clearly for a beginner.\n\nInstructions:\n1. Summarize the main objective of the paper.\n2. Explain the methodology used.\n3. Highlight the most important findings.\n4. Mention limitations of the research.\n\nOutput Format:\n* Simple summary\n* Key concepts\n* Important results\n* Practical implications"
}
```

### `POST /score`

Score an existing prompt for structural quality (0–100).

**Request:**
```json
{ "prompt": "You are an expert..." }
```

**Response:**
```json
{
  "score": 78,
  "max": 100,
  "breakdown": { "role": true, "task": true, "context": false, ... }
}
```

### `GET /templates`

Returns available prompt template categories.

### `GET /health`

Returns `{"status": "ok"}`.

---

## Supported Models

The default model is **`meta-llama/Meta-Llama-3-8B-Instruct`**. You can switch to any HuggingFace chat model by setting `HF_MODEL_ID` in `.env`:

| Model | Size | Notes |
|---|---|---|
| `meta-llama/Meta-Llama-3-8B-Instruct` | 8B | Default – strong reasoning |
| `Qwen/Qwen2.5-7B-Instruct` | 7B | Fast & capable |
| `HuggingFaceH4/zephyr-7b-beta` | 7B | Good for structured output |

---

## Features

- ✅ Prompt restructuring via small LLM (3B–8B)
- ✅ Chrome Extension popup (click icon → instant access)
- ✅ Full-page web UI at `localhost:8000`
- ✅ Domain templates (coding, research, summarization, data analysis, writing)
- ✅ Prompt quality scoring (heuristic, 0–100)
- ✅ Copy to clipboard
- ✅ Export as `.txt`
- ✅ Ctrl+Enter shortcut
- ✅ Dark-themed responsive UI
- ✅ Backend health indicator (green/red dot)
- ✅ Interactive API docs at `/docs`

---

## Chrome Extension Setup

1. Make sure the backend is running (`python -m backend.main`)
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. Click the ⚡ Prompt Maker icon in your toolbar — done!

The popup connects to `http://127.0.0.1:8000`. A green dot in the header confirms the backend is reachable.

---

## License

MIT
