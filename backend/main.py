"""FastAPI backend for Sensible Soccer ROM Editor."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from sslib import decode_rom, validate_teams, update_rom
from .session_store import store


app = FastAPI(title="Sensible Soccer ROM Editor")


class ValidateRequest(BaseModel):
    session_id: str
    teams_json: dict


class GenerateRomRequest(BaseModel):
    session_id: str
    teams_json: dict


def detect_edition(rom_size: int) -> str:
    if rom_size >= 0x400000:
        return "international"
    return "original"


@app.on_event("startup")
async def startup():
    await store.start_cleanup_task()


@app.on_event("shutdown")
async def shutdown():
    await store.stop_cleanup_task()


@app.post("/api/upload-rom")
async def upload_rom(rom_file: UploadFile = File(...)):
    rom_bytes = await rom_file.read()

    try:
        teams_json = decode_rom(rom_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode ROM: {str(e)}")

    session_id = store.create(rom_bytes)

    teams_count = {
        "national": len(teams_json.get("national", [])),
        "club": len(teams_json.get("club", [])),
        "custom": len(teams_json.get("custom", [])),
    }

    return {
        "session_id": session_id,
        "rom_info": {
            "size": len(rom_bytes),
            "edition": detect_edition(len(rom_bytes)),
            "teams_count": teams_count,
        },
        "teams_json": teams_json,
    }


@app.post("/api/validate")
async def validate(req: ValidateRequest):
    rom_bytes = store.get(req.session_id)
    if rom_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    errors, warnings = validate_teams(rom_bytes, req.teams_json)

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


@app.post("/api/generate-rom")
async def generate_rom(req: GenerateRomRequest):
    rom_bytes = store.get(req.session_id)
    if rom_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    errors, warnings = validate_teams(rom_bytes, req.teams_json)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Validation failed",
                "errors": errors,
                "warnings": warnings,
            },
        )

    try:
        modified_rom = update_rom(rom_bytes, req.teams_json)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return Response(
        content=modified_rom,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=modified_rom.md"},
    )
