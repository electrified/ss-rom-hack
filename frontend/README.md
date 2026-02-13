# Sensible Soccer ROM Editor - Web Interface

This is the web frontend for the Sensible Soccer ROM Editor, built with **FastAPI** (backend) and **React + Vite** (frontend).

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+

### Initial Setup

If this is your first time running the application, you need to set up the virtual environment and install dependencies.

#### 1. Create and Activate Virtual Environment

From the project root directory:

```bash
# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# On Windows, use:
# .venv\Scripts\activate
```

#### 2. Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

#### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Starting the Application

You need to run both the backend and frontend simultaneously in separate terminals.

#### Terminal 1: Start the Backend

From the project root directory:

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --reload
```

The backend will start on http://localhost:8000

**Alternative (without activating venv):**
```bash
./.venv/bin/uvicorn backend.main:app --reload --app-dir .
```

#### Terminal 2: Start the Frontend

From the project root directory:

```bash
cd frontend
npm run dev
```

The frontend will start on http://localhost:5173

### Usage

1. Open your browser to http://localhost:5173
2. **Step 1**: Upload your Sensible Soccer ROM file (.md or .bin)
3. **Step 2**: Review the ROM information and download the `teams.json` file
4. **Step 3**: Edit the JSON file with your changes (team names, players, tactics, etc.)
5. **Step 4**: Upload your modified `teams.json` file
6. **Step 5**: Review validation results (errors must be fixed, warnings are optional)
7. **Step 6**: Download your modified ROM file

## Development

### Backend Development

The backend provides three API endpoints:

- `POST /api/upload-rom` - Upload and decode a ROM file
- `POST /api/validate` - Validate modified teams JSON
- `POST /api/generate-rom` - Generate modified ROM file

Sessions are stored in memory with a 30-minute TTL. The backend auto-reloads on file changes when run with `--reload`.

### Frontend Development

The frontend is built with React and uses Vite for fast development. The Vite dev server proxies `/api` requests to the backend automatically.

Key files:
- `src/App.jsx` - Main application component with step flow
- `src/api.js` - API client functions
- `src/components/` - React components for each step

### Building for Production

To build the frontend for production:

```bash
cd frontend
npm run build
```

This creates a `dist/` folder with static files. For production deployment, you'll want to serve these static files from the backend or a separate web server.

## Troubleshooting

### Port already in use

If you see "Address already in use" errors:

**Backend (port 8000):**
```bash
# Find the process
lsof -i :8000
# Kill it
kill -9 <PID>
```

**Frontend (port 5173):**
```bash
# Find the process
lsof -i :5173
# Kill it
kill -9 <PID>
```

### Missing dependencies

If you get import errors:

**Backend:**
```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### Recreating the Virtual Environment

If your virtual environment is corrupted or missing:

```bash
# Remove the old venv
rm -rf .venv

# Create a new one
python3 -m venv .venv

# Activate and install dependencies
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### CORS errors

The Vite dev server is configured to proxy `/api` requests to `localhost:8000`, so you shouldn't see CORS errors during development. If you do, make sure both servers are running and check the `vite.config.js` proxy settings.

## Architecture

```
┌─────────────┐      HTTP/API      ┌─────────────┐
│   Browser   │ ◄────────────────► │  Frontend   │
│  (User)     │                    │  (React)    │
└─────────────┘                    └──────┬──────┘
                                          │ Proxy
                                          ▼
                                   ┌─────────────┐
                                   │   Backend   │
                                   │  (FastAPI)  │
                                   └──────┬──────┘
                                          │
                                   ┌──────┴──────┐
                                   │  sslib API  │
                                   │ decode_rom()│
                                   │validate_... │
                                   │update_rom() │
                                   └─────────────┘
```

## Session Management

The backend uses an in-memory session store with the following features:
- 30-minute TTL (time-to-live) for sessions
- Automatic cleanup of expired sessions every 5 minutes
- Each session stores the original ROM bytes (~512KB) and metadata

Sessions are identified by UUID and are lost if the backend restarts. For production use, consider implementing persistent storage (Redis, database, etc.).
