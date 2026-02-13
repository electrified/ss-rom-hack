# Web Frontend for Sensible Soccer ROM Editor

## Context

The `sslib` package exposes three functions: `decode_rom()`, `validate_teams()`, `update_rom()`. We need a web frontend so users can upload a ROM, download the decoded JSON, upload a modified JSON, validate it, and download a patched ROM. This is the MVP — no in-browser team editing yet.

**Stack**: FastAPI (Python backend) + React/Vite (frontend). Hosted deployment.

## Project Structure

```
backend/
  main.py              — FastAPI app, 3 API routes
  session_store.py      — in-memory {uuid: rom_bytes} with TTL cleanup
  requirements.txt      — fastapi, uvicorn, python-multipart
frontend/
  src/
    main.jsx
    App.jsx             — main flow: upload → summary → edit → validate → download
    api.js              — fetch wrappers for /api/*
    components/
      RomUpload.jsx     — file input + drag-drop, calls POST /api/upload-rom
      TeamsSummary.jsx  — edition, team counts, "download JSON" button
      JsonUpload.jsx    — file input for modified JSON, auto-validates on upload
      ValidationResults.jsx — errors (red, blocking) + warnings (yellow)
      DownloadButton.jsx    — calls POST /api/generate-rom, triggers browser download
  index.html
  vite.config.js        — proxy /api → localhost:8000
  package.json
```

## API Design (3 endpoints)

### `POST /api/upload-rom`
- Request: multipart form with `rom_file`
- Decodes ROM via `decode_rom()`, stores `rom_bytes` in session store keyed by UUID
- Response: `{ session_id, rom_info: { size, edition, teams_count }, teams_json }`

### `POST /api/validate`
- Request: `{ session_id, teams_json }`
- Looks up ROM bytes from session, calls `validate_teams(rom_bytes, teams_json)`
- Response: `{ valid: bool, errors: [], warnings: [] }`

### `POST /api/generate-rom`
- Request: `{ session_id, teams_json }`
- Validates first, then calls `update_rom(rom_bytes, teams_json)`
- Response: binary ROM download (`application/octet-stream`)
- Returns 400 on validation errors or ROM overflow

## Session Store

Simple in-memory dict with 30-minute TTL. Background asyncio task cleans up expired sessions every 5 minutes. No Redis/database needed for MVP. Each session stores only `rom_bytes` (~512KB) and `created_at`/`last_access` timestamps.

## Frontend Flow

1. **RomUpload** — user picks `.md` file → uploads → receives `session_id` + `teams_json`
2. **TeamsSummary** — shows edition/counts, button to download decoded JSON
3. **JsonUpload** — user uploads modified `.json` → auto-validates against ROM
4. **ValidationResults** — shows errors/warnings
5. **DownloadButton** — visible only when valid, generates and downloads patched ROM

State lives in `App.jsx`: `sessionId`, `teamsJson`, `romInfo`, `validationResults`.

## Frontend Dev Setup

`vite.config.js` proxies `/api` to `http://localhost:8000`, so the React app uses relative paths (`/api/upload-rom`) — no CORS needed during dev. For production, FastAPI serves the built `frontend/dist/` as static files.

## Dependencies

**Backend** (`backend/requirements.txt`):
```
fastapi
uvicorn[standard]
python-multipart
```

**Frontend** (`frontend/package.json`):
- `react`, `react-dom`
- `@vitejs/plugin-react`, `vite` (devDeps)

No other libraries needed for MVP.

## Execution Order

1. Create `backend/` — `requirements.txt`, `session_store.py`, `main.py`
2. Create `frontend/` — `npm create vite`, install deps
3. Build `api.js` — fetch wrappers
4. Build components: `RomUpload` → `TeamsSummary` → `JsonUpload` → `ValidationResults` → `DownloadButton`
5. Wire up `App.jsx`
6. Add basic CSS
7. Test end-to-end

## Verification

1. Upload `ssint_orig.md` → see 179 teams (51+64+64), edition "international"
2. Download JSON → matches `teams.json` from CLI tool
3. Re-upload same JSON → validation passes, 0 errors, 0 warnings
4. Upload JSON with invalid character (e.g. `@`) → see error
5. Generate ROM from unmodified JSON → download, binary-diff against original (only byte-18 tactic diffs in custom teams, same as CLI)
6. Wait for session to expire → get 404 on validate, shows user-friendly error
7. `python3 -c "from sslib import decode_rom, validate_teams, update_rom"` still works (library unchanged)
