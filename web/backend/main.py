"""FastAPI backend for Sensible Soccer ROM Editor."""

import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

# Add parent directory to path for sslib import
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from sslib import decode_rom, validate_teams, update_rom

from session_store import session_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    # Startup
    await session_store.start_cleanup_task()
    yield
    # Shutdown
    session_store.stop_cleanup_task()


app = FastAPI(title="Sensible Soccer ROM Editor", lifespan=lifespan)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# CORS (for development - can be removed in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main page with ROM upload form."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/upload-rom", response_class=HTMLResponse)
async def upload_rom(request: Request, rom_file: UploadFile = File(...)):
    """Upload ROM file, decode teams, create session."""
    if not rom_file.filename.endswith(".md"):
        return templates.TemplateResponse(
            "partials/error.html",
            {"request": request, "message": "Please upload a .md ROM file"},
        )

    try:
        rom_bytes = await rom_file.read()
        teams = decode_rom(rom_bytes)

        # Count teams
        team_counts = {
            "national": len(teams.get("national", [])),
            "club": len(teams.get("club", [])),
            "custom": len(teams.get("custom", [])),
            "total": sum(
                len(teams.get(cat, [])) for cat in ["national", "club", "custom"]
            ),
        }

        # Detect edition
        edition = "international" if team_counts["custom"] == 64 else "standard"

        # Create session
        session_id = session_store.create(rom_bytes)

        # Convert teams to JSON string for the form
        teams_json = json.dumps(teams, indent=2)

        return templates.TemplateResponse(
            "partials/rom_uploaded.html",
            {
                "request": request,
                "session_id": session_id,
                "rom_info": {
                    "filename": rom_file.filename,
                    "size": len(rom_bytes),
                    "edition": edition,
                    "team_counts": team_counts,
                },
                "teams_json": teams_json,
            },
        )
    except Exception as e:
        return templates.TemplateResponse(
            "partials/error.html",
            {"request": request, "message": f"Error processing ROM: {str(e)}"},
        )


@app.post("/api/validate", response_class=HTMLResponse)
async def validate(
    request: Request, session_id: str = Form(...), teams_json: str = Form(...)
):
    """Validate teams JSON against the original ROM."""
    rom_bytes = session_store.get(session_id)
    if rom_bytes is None:
        return templates.TemplateResponse(
            "partials/error.html",
            {
                "request": request,
                "message": "Session expired. Please re-upload your ROM.",
            },
        )

    try:
        teams_data = json.loads(teams_json)
        errors, warnings = validate_teams(rom_bytes, teams_data)

        is_valid = len(errors) == 0

        return templates.TemplateResponse(
            "partials/validation_results.html",
            {
                "request": request,
                "session_id": session_id,
                "teams_json": teams_json,
                "is_valid": is_valid,
                "errors": errors,
                "warnings": warnings,
            },
        )
    except json.JSONDecodeError as e:
        return templates.TemplateResponse(
            "partials/validation_results.html",
            {
                "request": request,
                "session_id": session_id,
                "teams_json": teams_json,
                "is_valid": False,
                "errors": [f"Invalid JSON: {str(e)}"],
                "warnings": [],
            },
        )
    except Exception as e:
        return templates.TemplateResponse(
            "partials/error.html",
            {"request": request, "message": f"Validation error: {str(e)}"},
        )


@app.post("/api/generate-rom")
async def generate_rom(session_id: str = Form(...), teams_json: str = Form(...)):
    """Generate patched ROM from teams JSON."""
    rom_bytes = session_store.get(session_id)
    if rom_bytes is None:
        raise HTTPException(status_code=404, detail="Session expired")

    try:
        teams_data = json.loads(teams_json)

        # Validate first
        errors, warnings = validate_teams(rom_bytes, teams_data)
        if errors:
            raise HTTPException(status_code=400, detail="Validation failed")

        # Generate ROM
        patched_rom = update_rom(rom_bytes, teams_data)

        # Save to temp file
        output_path = Path(f"/tmp/patched_{session_id}.md")
        output_path.write_bytes(patched_rom)

        return FileResponse(
            path=output_path,
            filename="patched_rom.md",
            media_type="application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
