"""
main.py — FastAPI application entry-point.

Endpoints
---------
POST /generate          – convert a messy prompt into a structured one
POST /score             – score an existing prompt (0-100)
GET  /templates         – list available prompt templates
GET  /                  – serve the frontend (index.html)
GET  /health            – simple health-check
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.config import CORS_ORIGINS, runtime_settings
from backend.prompt_engine import (
    PROMPT_TEMPLATES,
    generate_structured_prompt,
    score_prompt,
)

# ── App initialisation ────────────────────────────────────────────────
app = FastAPI(
    title="Prompt Maker",
    description="Convert messy human prompts into optimized LLM prompts.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve frontend static files ──────────────────────────────────────
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ── Pydantic models ──────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Raw user prompt")
    template: str | None = Field(
        None,
        description="Optional template category: coding, research, summarization, data_analysis, writing",
    )


class GenerateResponse(BaseModel):
    structured_prompt: str


class ScoreRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class ScoreResponse(BaseModel):
    score: int
    max: int
    breakdown: dict[str, bool]


# ── Routes ────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the single-page frontend."""
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"message": "Frontend not found. Visit /docs for the API."})


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    """Accept a raw prompt and return the optimised, structured version."""
    try:
        result = await generate_structured_prompt(
            user_prompt=req.prompt,
            template=req.template,
        )
        return GenerateResponse(structured_prompt=result)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest):
    """Score a prompt for structural quality (0-100)."""
    result = score_prompt(req.prompt)
    return ScoreResponse(**result)


@app.get("/templates")
async def templates():
    """Return the available prompt template categories."""
    return {"templates": PROMPT_TEMPLATES}


# ── Settings ──────────────────────────────────────────────────────────

class SettingsRequest(BaseModel):
    hf_api_token: str | None = Field(None, description="HuggingFace API token")
    hf_model_id: str | None = Field(None, description="HuggingFace model ID")


@app.get("/settings")
async def get_settings():
    """Return current settings (token is masked)."""
    token = runtime_settings["hf_api_token"]
    masked = ""
    if token:
        masked = token[:5] + "*" * (len(token) - 9) + token[-4:] if len(token) > 9 else "****"
    return {
        "hf_api_token_set": bool(token),
        "hf_api_token_masked": masked,
        "hf_model_id": runtime_settings["hf_model_id"],
    }


@app.post("/settings")
async def update_settings(req: SettingsRequest):
    """Update runtime settings (token, model) without restarting."""
    if req.hf_api_token is not None:
        runtime_settings["hf_api_token"] = req.hf_api_token.strip()
    if req.hf_model_id is not None:
        runtime_settings["hf_model_id"] = req.hf_model_id.strip()
    return {"status": "ok", "message": "Settings updated."}


# ── Standalone runner ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    from backend.config import HOST, PORT

    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
