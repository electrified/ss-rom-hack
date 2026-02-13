"""FastAPI backend for Sensible Soccer ROM Editor."""

import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Add parent directory to path for sslib import
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import io

from session_store import session_store
from sslib import decode_rom, validate_teams, update_rom


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    # Startup
    session_store.start_cleanup_task()
    yield
    # Shutdown
    session_store.stop_cleanup_task()


app = FastAPI(title="Sensible Soccer ROM Editor API", lifespan=lifespan)


class RomInfo(BaseModel):
    """ROM metadata."""

    size: int
    edition: str
    teams_count: Dict[str, int]


class UploadResponse(BaseModel):
    """Response from ROM upload."""

    session_id: str
    rom_info: RomInfo
    teams_json: Dict[str, Any]


class ValidateRequest(BaseModel):
    """Request to validate teams JSON."""

    session_id: str
    teams_json: Dict[str, Any]


class ValidationIssue(BaseModel):
    """A single validation error or warning."""

    path: str
    message: str


class ValidateResponse(BaseModel):
    """Response from validation."""

    valid: bool
    errors: List[ValidationIssue]
    warnings: List[ValidationIssue]


class GenerateRomRequest(BaseModel):
    """Request to generate modified ROM."""

    session_id: str
    teams_json: Dict[str, Any]


@app.post("/api/upload-rom", response_model=UploadResponse)
async def upload_rom(rom_file: UploadFile = File(...)):
    """
    Upload a ROM file, decode it, and store in session.

    Returns session ID and decoded teams JSON.
    """
    # Read ROM bytes
    rom_bytes = await rom_file.read()

    # Validate ROM size (should be around 512KB)
    if len(rom_bytes) < 100000:
        raise HTTPException(status_code=400, detail="ROM file too small")

    try:
        # Decode the ROM
        teams_data = decode_rom(rom_bytes)

        # Count teams by type
        teams_count = {
            "national": len(teams_data.get("national", [])),
            "club": len(teams_data.get("club", [])),
            "custom": len(teams_data.get("custom", [])),
        }

        # Detect edition from pointer table location
        edition = "international" if len(rom_bytes) > 0x1F0000 else "original"

        # Create session
        session_id = session_store.create_session(rom_bytes)

        return UploadResponse(
            session_id=session_id,
            rom_info=RomInfo(
                size=len(rom_bytes), edition=edition, teams_count=teams_count
            ),
            teams_json=teams_data,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode ROM: {str(e)}")


@app.post("/api/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest):
    """
    Validate teams JSON against the original ROM constraints.

    Returns validation errors and warnings.
    """
    # Get session
    session = session_store.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        # Validate teams
        errors, warnings = validate_teams(session.rom_bytes, request.teams_json)

        # Convert to ValidationIssue format
        error_issues = [
            ValidationIssue(path=e.get("path", ""), message=e.get("message", str(e)))
            for e in errors
        ]
        warning_issues = [
            ValidationIssue(path=w.get("path", ""), message=w.get("message", str(w)))
            for w in warnings
        ]

        return ValidateResponse(
            valid=len(errors) == 0, errors=error_issues, warnings=warning_issues
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.post("/api/generate-rom")
async def generate_rom(request: GenerateRomRequest):
    """
    Generate and download a modified ROM.

    Validates first, then generates the ROM if valid.
    """
    # Get session
    session = session_store.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    try:
        # Validate first
        errors, warnings = validate_teams(session.rom_bytes, request.teams_json)

        if errors:
            raise HTTPException(
                status_code=400, detail=f"Validation failed with {len(errors)} errors"
            )

        # Generate modified ROM
        modified_rom = update_rom(session.rom_bytes, request.teams_json)

        # Create file-like object for streaming
        rom_stream = io.BytesIO(modified_rom)

        return StreamingResponse(
            rom_stream,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=modified_rom.md"},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate ROM: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
