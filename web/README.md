# Sensible Soccer ROM Editor - Web Interface

A web frontend for editing Sensible Soccer (Mega Drive) ROM files using FastAPI and HTMX.

## Features

- Upload ROM files (.md)
- Download decoded teams as JSON
- Validate modified team data
- Generate patched ROM files

## Quick Start

```bash
cd web

# Install dependencies
pip install -r backend/requirements.txt

# Run the server
python backend/main.py
```

The server will start on `http://localhost:8000`

## How to Use

1. **Upload ROM**: Select your original Sensible Soccer ROM file (.md)
2. **Download JSON**: Save the decoded teams data
3. **Edit**: Modify the JSON file with your changes
4. **Validate**: Upload your modified JSON to check for errors
5. **Download**: Get your patched ROM file

## Project Structure

```
web/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── session_store.py  # In-memory session management
│   └── requirements.txt  # Python dependencies
├── templates/
│   ├── base.html         # Base template
│   ├── index.html        # Main page
│   └── partials/         # HTMX partial templates
└── static/css/
    └── style.css         # Styles
```

## API Endpoints

- `POST /api/upload-rom` - Upload and decode ROM
- `POST /api/validate` - Validate teams JSON
- `POST /api/generate-rom` - Generate patched ROM

## Session Management

Sessions are stored in memory with a 30-minute TTL. Expired sessions are automatically cleaned up every 5 minutes.
