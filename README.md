# AgroSense

AgroSense is a full-stack plant disease diagnosis app.

- Frontend: React + Vite
- Backend: Flask (Python)
- Purpose: upload crop images, get disease analysis, and receive treatment guidance

## What You Can Do

- Upload a plant image from phone or desktop
- Get AI-based disease identification and severity insights
- View treatment and seasonal care guidance
- Download/share analysis results
- Review previous scans from history

## Project Structure

```text
AgroSense/
├── client/                  # React frontend
│   ├── src/components/      # UI components
│   ├── src/App.jsx          # App shell
│   └── package.json
├── server/                  # Flask backend
│   ├── app.py               # API server entry point
│   ├── requirements.txt
│   └── render.yaml
├── requirements-production.txt
└── README.md
```

## Quick Start

### 1. Start the backend

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs on `http://localhost:5000` by default.

### 2. Start the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

## Environment Notes

Create a `.env` in `server/` when needed (for example, Gemini key/config). Keep secrets out of source control.

## Useful Scripts

Frontend (`client/package.json`):

- `npm run dev` - local development server
- `npm run build` - production build
- `npm run preview` - preview production build

Backend:

- `python app.py` - run Flask API

## API (High-Level)

Common endpoints used by the client:

- `GET /api/health` - health check
- `POST /api/analyze` - analyze uploaded image

## Deployment

- Frontend: any static host (or bundled with your chosen platform)
- Backend: Render/Azure/other Python host
- See deployment-specific files under `server/` (for example, `render.yaml`)

## Contributing

- Keep changes focused and tested
- Update docs when behavior or commands change
- Prefer small, reviewable pull requests

## License

See `LICENSE`.
