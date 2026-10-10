# AgroSense Server

Flask backend API for plant disease analysis.

## Quick Start

```bash
cd server
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # Mac/Linux

pip install -U pip
pip install -r requirements.txt
python app.py
```

The API runs on `http://localhost:8000` by default.

## Environment

Create `server/.env` for local configuration:

```env
# AI providers
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
HUGGINGFACE_API_KEY=your_hf_token

# Provider fallback order
PROVIDER_ORDER=gemini,hf,mock

# Server
HOST=0.0.0.0
PORT=8000
FLASK_DEBUG=true

# Frontend origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Main Endpoints

- `GET /api/health` - Health check
- `POST /api/analyze` - Analyze uploaded image
- `GET /api/diseases` - List disease entries used by the app

## Logs

Runtime logs are written to `server/logs/app.log`.

## Production Notes

- Deploy config: `server/render.yaml`
- `requirements.txt` keeps cloud deploy lightweight
- Optional local-model dependencies:

```bash
pip install -r requirements-optional-local-models.txt
```
