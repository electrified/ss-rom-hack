import sys
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).parent.parent))
from sslib import decode_rom, validate_teams, update_rom

from session_store import session_store


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def detect_edition(teams: dict) -> str:
    nat_count = len(teams.get("national", []))
    if nat_count == 51:
        return "international"
    elif nat_count == 53:
        return "original"
    return "unknown"


@app.on_event("startup")
async def startup():
    session_store.start()


@app.on_event("shutdown")
async def shutdown():
    session_store.stop()


@app.post("/api/upload-rom")
async def upload_rom(file: UploadFile = File(..., alias="rom_file")):
    rom_bytes = await file.read()
    if len(rom_bytes) < 0x100:
        raise HTTPException(status_code=400, detail="File too small to be a ROM")

    teams = decode_rom(rom_bytes)
    edition = detect_edition(teams)

    teams_count = {
        "national": len(teams["national"]),
        "club": len(teams["club"]),
        "custom": len(teams["custom"]),
    }

    session_id = session_store.create(rom_bytes)

    return {
        "session_id": session_id,
        "rom_info": {
            "size": len(rom_bytes),
            "edition": edition,
            "teams_count": teams_count,
        },
        "teams_json": teams,
    }


@app.post("/api/validate")
async def validate(payload: dict):
    session_id = payload.get("session_id")
    teams_json = payload.get("teams_json")

    if not session_id or not teams_json:
        raise HTTPException(status_code=400, detail="Missing session_id or teams_json")

    rom_bytes = session_store.get(session_id)
    if rom_bytes is None:
        raise HTTPException(status_code=404, detail="Session expired or not found")

    errors, warnings = validate_teams(rom_bytes, teams_json)

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


@app.post("/api/generate-rom")
async def generate_rom(payload: dict):
    session_id = payload.get("session_id")
    teams_json = payload.get("teams_json")

    if not session_id or not teams_json:
        raise HTTPException(status_code=400, detail="Missing session_id or teams_json")

    rom_bytes = session_store.get(session_id)
    if rom_bytes is None:
        raise HTTPException(status_code=404, detail="Session expired or not found")

    errors, warnings = validate_teams(rom_bytes, teams_json)
    if errors:
        raise HTTPException(status_code=400, detail=f"Validation errors: {errors}")

    try:
        new_rom = update_rom(rom_bytes, teams_json)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return Response(
        content=new_rom,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=modified.md"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
