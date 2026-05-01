# Personal Statement Scorer — FastAPI Backend

## Setup

### 1. Create a Python virtual environment
```bash
python -m venv venv
venv\Scripts\activate        # Windows
```

### 2. Install PyTorch first (CUDA 12.1 example)
```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```
For CPU-only:
```bash
pip install torch
```

### 3. Install remaining dependencies
```bash
pip install fastapi "uvicorn[standard]" pydantic accelerate bitsandbytes peft trl transformers
pip install "unsloth[cu121-torch220] @ git+https://github.com/unslothai/unsloth.git"
```

### 4. Run the server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The adapter zip is auto-extracted from `C:/Users/ruqay/Downloads/ps_lora_v3_final.zip`
on first startup. Model loading takes ~30–60 seconds.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"ok": true, "model_loaded": true/false}` |
| POST | `/score/personal-statement` | Score a personal statement |

### POST body
```json
{
  "academic_goals": "...",
  "career_goals": "...",
  "leadership_experience": "...",
  "personal_statement": "full combined text"
}
```

### Response
```json
{
  "interests_and_values": 23.8,
  "academic_commitment": 25.0,
  "clarity_of_vision": 25.3,
  "organization": 24.3,
  "language_quality": 24.7,
  "total_score": 123.1,
  "grade_pct": 82.1
}
```

## Notes
- If the model output doesn't match the prompt format from training, edit `_build_prompt()` in `model.py`.
- The adapter is loaded from `adapter/` (auto-extracted). Delete that folder to re-extract.
