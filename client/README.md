# AgroSense Client

React + Vite frontend for crop image upload, disease analysis, and treatment guidance.

## Quick Start

```bash
cd client
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## API Configuration

- Default local API: `http://localhost:8000/api`
- Default production API: `https://agrosense-backend-otb9.onrender.com/api`
- Override with: `VITE_API_URL`

Example (`client/.env.local`):

```env
VITE_API_URL=http://localhost:8000/api
```

Config source: `src/config/api.js`.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production (output: dist/)
npm run preview  # Preview production build
npm run lint     # Run ESLint
```
