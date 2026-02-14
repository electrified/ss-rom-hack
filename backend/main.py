"""FastAPI backend for Sensible Soccer ROM Editor."""

import os
import sys
import hashlib
import json
import io
import time
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, List

# Add parent directory to path for sslib import
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Import sslib
from sslib import decode_rom, validate_teams, update_rom

# Import new components
from backend.models.database import (
    init_database,
    close_database,
    Rom,
    Session as SessionModel,
    Upload,
    Validation,
)
import backend.models.database as database_module
from backend.models.redis import init_redis, close_redis
import backend.models.redis as redis_module
from backend.storage.local import init_storage
import backend.storage.local as storage_module
from backend.middleware.logging import RequestLoggingMiddleware
from backend.admin.router import router as admin_router, init_admin_auth
from backend.metrics.prometheus import router as metrics_router
from backend.health import router as health_router, set_startup_complete

# Load environment variables
load_dotenv()

# Known ROM MD5 checksums
ROM_MD5_ORIGINAL = "f6fcf5843786bd44f8df6b648661a437"
ROM_MD5_INTERNATIONAL = "403ceb23b4cf27d3d9c8965409960bb4"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    # Startup
    print("Starting up...")

    # Initialize database
    database_url = os.getenv(
        "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ssmdhack"
    )
    await init_database(database_url)
    print("✓ Database connected")

    # Initialize Redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_ttl = int(os.getenv("REDIS_SESSION_TTL", "1800"))
    await init_redis(redis_url, redis_ttl)
    print("✓ Redis connected")

    # Initialize storage
    storage_path = os.getenv("STORAGE_PATH", "/data/roms")
    init_storage(storage_path)
    print(f"✓ Storage initialized at {storage_path}")

    # Initialize admin auth
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD_HASH", "")
    if admin_pass:
        init_admin_auth(admin_user, admin_pass)
        print("✓ Admin auth configured")

    # Mark startup complete for health checks
    set_startup_complete()
    print("✓ Startup complete")

    yield

    # Shutdown
    print("Shutting down...")
    await close_redis()
    await close_database()
    print("✓ Cleanup complete")


app = FastAPI(title="Sensible Soccer ROM Editor API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Include routers
app.include_router(admin_router)
app.include_router(metrics_router)
app.include_router(health_router)


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
    start_time = time.time()

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

        # Calculate MD5
        rom_md5 = hashlib.md5(rom_bytes).hexdigest()

        # Detect edition from MD5
        if rom_md5 == ROM_MD5_ORIGINAL:
            edition = "original"
        elif rom_md5 == ROM_MD5_INTERNATIONAL:
            edition = "international"
        else:
            edition = "unknown"

        # Save ROM to shared storage
        storage_path = str(
            await storage_module.rom_storage.save_rom(rom_md5, rom_bytes)
        )

        # Create or update ROM record in database
        async with database_module.async_session_maker() as db_session:
            existing_rom = await db_session.get(Rom, rom_md5)
            if existing_rom:
                existing_rom.last_seen_at = datetime.utcnow()
            else:
                new_rom = Rom(
                    md5_hash=rom_md5,
                    edition=edition,
                    size_bytes=len(rom_bytes),
                    team_count_national=teams_count["national"],
                    team_count_club=teams_count["club"],
                    team_count_custom=teams_count["custom"],
                    storage_path=storage_path,
                )
                db_session.add(new_rom)
            await db_session.commit()

        # Create session in Redis
        import uuid

        session_id = str(uuid.uuid4())
        await redis_module.redis_store.create_session(
            session_id, rom_md5, storage_path, teams_data
        )

        # Create session audit record
        async with database_module.async_session_maker() as db_session:
            session_record = SessionModel(
                id=session_id,
                rom_md5=rom_md5,
                expires_at=datetime.utcnow() + timedelta(seconds=1800),
                container_hostname=os.getenv("HOSTNAME", "unknown"),
            )
            db_session.add(session_record)
            await db_session.commit()

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
    start_time = time.time()

    # Get session from Redis
    session_data = await redis_module.redis_store.get_session(request.session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Extend session TTL
    await redis_module.redis_store.extend_session(request.session_id)

    # Load ROM from storage
    rom_bytes = await storage_module.rom_storage.load_rom(session_data["rom_md5"])
    if not rom_bytes:
        raise HTTPException(status_code=404, detail="ROM file not found in storage")

    try:
        # Validate teams
        errors, warnings = validate_teams(rom_bytes, request.teams_json)

        # Convert to ValidationIssue format
        error_issues = [ValidationIssue(path="", message=str(e)) for e in errors]
        warning_issues = [ValidationIssue(path="", message=str(w)) for w in warnings]

        is_valid = len(errors) == 0
        duration_ms = int((time.time() - start_time) * 1000)

        # Store validation result in database
        # Note: We don't have upload_id here since this might be pre-upload validation
        # Validation results are stored when JSON is actually uploaded via admin tracking

        return ValidateResponse(
            valid=is_valid, errors=error_issues, warnings=warning_issues
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.post("/api/generate-rom")
async def generate_rom(request: GenerateRomRequest):
    """
    Generate and download a modified ROM.

    Validates first, then generates the ROM if valid.
    """
    # Get session from Redis
    session_data = await redis_module.redis_store.get_session(request.session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Load ROM from storage
    rom_bytes = await storage_module.rom_storage.load_rom(session_data["rom_md5"])
    if not rom_bytes:
        raise HTTPException(status_code=404, detail="ROM file not found in storage")

    try:
        # Validate first
        errors, warnings = validate_teams(rom_bytes, request.teams_json)

        if errors:
            raise HTTPException(
                status_code=400, detail=f"Validation failed with {len(errors)} errors"
            )

        # Generate modified ROM
        modified_rom = update_rom(rom_bytes, request.teams_json)

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


@app.post("/api/upload-json")
async def upload_json(
    session_id: str,
    filename: str,
    teams_json: Dict[str, Any],
):
    """
    Store uploaded JSON for admin tracking.
    This is called by the frontend after successful validation.
    """
    # Get session from Redis
    session_data = await redis_module.redis_store.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Validate the JSON
    rom_bytes = await storage_module.rom_storage.load_rom(session_data["rom_md5"])
    errors, warnings = validate_teams(rom_bytes, teams_json)

    is_valid = len(errors) == 0

    # Store in database
    async with database_module.async_session_maker() as db_session:
        upload = Upload(
            session_id=session_id,
            filename=filename,
            json_content=teams_json,
        )
        db_session.add(upload)
        await db_session.flush()  # Get upload.id

        validation = Validation(
            upload_id=upload.id,
            is_valid=is_valid,
            errors=[{"path": "", "message": str(e)} for e in errors],
            warnings=[{"path": "", "message": str(w)} for w in warnings],
        )
        db_session.add(validation)
        await db_session.commit()

        return {
            "upload_id": upload.id,
            "is_valid": is_valid,
            "errors_count": len(errors),
            "warnings_count": len(warnings),
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
