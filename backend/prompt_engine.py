"""
prompt_engine.py — Core logic for transforming user prompts.

Houses:
  • generate_structured_prompt()  – calls HuggingFace Inference API
  • score_prompt()                – heuristic prompt-quality scorer
  • PROMPT_TEMPLATES              – predefined category templates
"""

from __future__ import annotations

import re
import httpx

from backend.config import (
    MAX_NEW_TOKENS,
    SYSTEM_PROMPT,
    TEMPERATURE,
    runtime_settings,
)

# ── Prompt Templates ──────────────────────────────────────────────────
PROMPT_TEMPLATES: dict[str, str] = {
    "coding": (
        "Write code to accomplish the following task. "
        "Include comments and handle edge cases."
    ),
    "research": (
        "Analyze the following research topic thoroughly. "
        "Provide sources and evidence-based reasoning."
    ),
    "summarization": (
        "Summarize the following content concisely. "
        "Highlight the key points and main takeaways."
    ),
    "data_analysis": (
        "Analyze the following dataset or data description. "
        "Provide insights, patterns, and actionable recommendations."
    ),
    "writing": (
        "Write content on the following topic. "
        "Ensure clarity, proper structure, and engaging tone."
    ),
}


# ── HuggingFace Inference API call ────────────────────────────────────

async def generate_structured_prompt(
    user_prompt: str,
    template: str | None = None,
) -> str:
    """Send *user_prompt* to the HuggingFace model and return the
    restructured, optimised prompt string.

    Parameters
    ----------
    user_prompt:
        The raw, unstructured prompt typed by the user.
    template:
        Optional template category key (e.g. ``"coding"``).
        When provided the matching template hint is prepended to give
        the model extra context about the desired domain.

    Returns
    -------
    str
        The model's structured prompt output.

    Raises
    ------
    RuntimeError
        If the API call fails or the token is missing.
    """
    token = runtime_settings["hf_api_token"]
    model = runtime_settings["hf_model_id"]
    api_url = runtime_settings["hf_api_url"]

    if not token:
        raise RuntimeError(
            "HF_API_TOKEN is not set. "
            "Please add your HuggingFace token in Settings."
        )

    # Optionally prepend a domain template hint
    domain_hint = ""
    if template and template in PROMPT_TEMPLATES:
        domain_hint = f"Domain context: {PROMPT_TEMPLATES[template]}\n\n"

    # Build the user message content
    user_content = (
        f"{domain_hint}"
        f"User prompt to optimize:\n\"{user_prompt}\""
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # OpenAI-compatible chat completions payload
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": MAX_NEW_TOKENS,
        "temperature": TEMPERATURE,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(api_url, headers=headers, json=payload)

    if response.status_code != 200:
        detail = response.text
        raise RuntimeError(
            f"HuggingFace API error ({response.status_code}): {detail}"
        )

    data = response.json()

    # OpenAI-compatible format: data.choices[0].message.content
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"Unexpected API response format: {data}")


# ── Prompt Quality Scorer ─────────────────────────────────────────────

_QUALITY_KEYWORDS: list[tuple[str, float]] = [
    # (pattern, weight)
    (r"\brole\b|you are", 15),          # role definition
    (r"\btask\b", 12),                  # clear task
    (r"\bcontext\b", 10),              # context
    (r"\bconstraint", 10),             # constraints
    (r"\bstep\b|instructions?", 12),   # step-by-step
    (r"\boutput\s*format", 15),        # output format
    (r"\b(1\.|2\.|3\.)", 8),           # numbered list
    (r"\bconcise|clear|structured", 6),# clarity keywords
    (r"\bexample", 5),                 # examples
    (r"\blimit|avoid|do not", 5),      # negative constraints
]


def score_prompt(prompt: str) -> dict:
    """Return a 0-100 quality score and per-criterion breakdown.

    This is a **heuristic** scorer — it checks for the presence of
    structural elements that well-engineered prompts typically contain.
    """
    total = 0.0
    max_possible = sum(w for _, w in _QUALITY_KEYWORDS)
    breakdown: dict[str, bool] = {}

    for pattern, weight in _QUALITY_KEYWORDS:
        found = bool(re.search(pattern, prompt, re.IGNORECASE))
        # Use the pattern as a readable label
        label = pattern.replace(r"\b", "").split("|")[0].strip()
        breakdown[label] = found
        if found:
            total += weight

    # Bonus for length (longer, detailed prompts tend to be better)
    length = len(prompt.split())
    if length > 80:
        total += 5
    if length > 150:
        total += 3

    score = min(round((total / max_possible) * 100), 100)

    return {"score": score, "max": 100, "breakdown": breakdown}
