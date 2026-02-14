"""Admin API endpoints with basic authentication."""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, desc
from sqlalchemy.orm import selectinload

from backend.models.database import (
    Session as SessionModel,
    Upload,
    Validation,
    Request,
    Rom,
)
import backend.models.database as database_module

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBasic()

# Admin credentials (set via environment variable)
ADMIN_USERNAME: Optional[str] = None
ADMIN_PASSWORD_HASH: Optional[str] = None


def init_admin_auth(username: str, password_hash: str):
    """Initialize admin credentials."""
    global ADMIN_USERNAME, ADMIN_PASSWORD_HASH
    ADMIN_USERNAME = username
    ADMIN_PASSWORD_HASH = password_hash


async def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    """Verify admin credentials using basic auth."""
    import bcrypt

    if not ADMIN_USERNAME or not ADMIN_PASSWORD_HASH:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin authentication not configured",
        )

    is_correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)

    # Verify password against bcrypt hash
    try:
        is_correct_password = bcrypt.checkpw(
            credentials.password.encode(), ADMIN_PASSWORD_HASH.encode()
        )
    except Exception:
        is_correct_password = False

    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    return credentials.username


@router.get("/stats")
async def get_stats(admin: str = Depends(verify_admin)):
    """Get summary statistics."""
    async with database_module.async_session_maker() as session:
        # Sessions in last 24h
        day_ago = datetime.utcnow() - timedelta(days=1)
        week_ago = datetime.utcnow() - timedelta(days=7)
        month_ago = datetime.utcnow() - timedelta(days=30)

        # Query stats
        sessions_24h = await session.scalar(
            select(func.count())
            .select_from(SessionModel)
            .where(SessionModel.created_at >= day_ago)
        )
        sessions_7d = await session.scalar(
            select(func.count())
            .select_from(SessionModel)
            .where(SessionModel.created_at >= week_ago)
        )
        sessions_30d = await session.scalar(
            select(func.count())
            .select_from(SessionModel)
            .where(SessionModel.created_at >= month_ago)
        )

        uploads_24h = await session.scalar(
            select(func.count())
            .select_from(Upload)
            .where(Upload.uploaded_at >= day_ago)
        )
        uploads_7d = await session.scalar(
            select(func.count())
            .select_from(Upload)
            .where(Upload.uploaded_at >= week_ago)
        )
        uploads_30d = await session.scalar(
            select(func.count())
            .select_from(Upload)
            .where(Upload.uploaded_at >= month_ago)
        )

        validation_failures_24h = await session.scalar(
            select(func.count())
            .select_from(Validation)
            .where(Validation.validated_at >= day_ago, Validation.is_valid == False)
        )

        unique_roms = await session.scalar(
            select(func.count()).select_from(Rom).where(Rom.deleted_at.is_(None))
        )

        total_requests_24h = await session.scalar(
            select(func.count())
            .select_from(Request)
            .where(Request.timestamp >= day_ago)
        )

        error_requests_24h = await session.scalar(
            select(func.count())
            .select_from(Request)
            .where(Request.timestamp >= day_ago, Request.response_status >= 400)
        )

        return {
            "sessions": {
                "24h": sessions_24h,
                "7d": sessions_7d,
                "30d": sessions_30d,
            },
            "uploads": {
                "24h": uploads_24h,
                "7d": uploads_7d,
                "30d": uploads_30d,
            },
            "validations": {
                "failures_24h": validation_failures_24h,
            },
            "roms": {
                "unique": unique_roms,
            },
            "requests": {
                "total_24h": total_requests_24h,
                "errors_24h": error_requests_24h,
            },
        }


@router.get("/sessions")
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: str = Depends(verify_admin),
):
    """List recent sessions."""
    async with database_module.async_session_maker() as session:
        offset = (page - 1) * limit

        # Get sessions with upload counts
        stmt = (
            select(SessionModel, Rom)
            .join(Rom, SessionModel.rom_md5 == Rom.md5_hash)
            .options(selectinload(SessionModel.uploads))
            .order_by(desc(SessionModel.created_at))
            .offset(offset)
            .limit(limit)
        )

        result = await session.execute(stmt)
        rows = result.all()

        sessions = []
        for sess, rom in rows:
            upload_count = len(sess.uploads) if sess.uploads else 0
            sessions.append(
                {
                    "id": sess.id,
                    "rom_md5": sess.rom_md5,
                    "edition": rom.edition,
                    "size_bytes": rom.size_bytes,
                    "created_at": sess.created_at.isoformat()
                    if sess.created_at
                    else None,
                    "expires_at": sess.expires_at.isoformat()
                    if sess.expires_at
                    else None,
                    "container_hostname": sess.container_hostname,
                    "upload_count": upload_count,
                }
            )

        # Get total count
        total = await session.scalar(select(func.count()).select_from(SessionModel))

        return {
            "sessions": sessions,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, admin: str = Depends(verify_admin)):
    """Get detailed session information."""
    async with database_module.async_session_maker() as session:
        stmt = (
            select(SessionModel)
            .where(SessionModel.id == session_id)
            .options(selectinload(SessionModel.rom))
            .options(
                selectinload(SessionModel.uploads).selectinload(Upload.validations)
            )
        )

        result = await session.execute(stmt)
        sess = result.scalar_one_or_none()

        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get request count
        request_count = await session.scalar(
            select(func.count())
            .select_from(Request)
            .where(Request.session_id == session_id)
        )

        uploads = []
        for upload in sess.uploads:
            validations = []
            for val in upload.validations:
                validations.append(
                    {
                        "id": val.id,
                        "is_valid": val.is_valid,
                        "errors_count": len(val.errors) if val.errors else 0,
                        "warnings_count": len(val.warnings) if val.warnings else 0,
                        "validated_at": val.validated_at.isoformat()
                        if val.validated_at
                        else None,
                    }
                )

            uploads.append(
                {
                    "id": upload.id,
                    "filename": upload.filename,
                    "uploaded_at": upload.uploaded_at.isoformat()
                    if upload.uploaded_at
                    else None,
                    "validations": validations,
                }
            )

        return {
            "id": sess.id,
            "rom": {
                "md5": sess.rom.md5_hash,
                "edition": sess.rom.edition,
                "size_bytes": sess.rom.size_bytes,
                "team_counts": {
                    "national": sess.rom.team_count_national,
                    "club": sess.rom.team_count_club,
                    "custom": sess.rom.team_count_custom,
                },
            },
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "expires_at": sess.expires_at.isoformat() if sess.expires_at else None,
            "container_hostname": sess.container_hostname,
            "uploads": uploads,
            "request_count": request_count,
        }


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: int, admin: str = Depends(verify_admin)):
    """Get upload details including full JSON content."""
    async with database_module.async_session_maker() as session:
        stmt = (
            select(Upload)
            .where(Upload.id == upload_id)
            .options(selectinload(Upload.session))
            .options(selectinload(Upload.validations))
        )

        result = await session.execute(stmt)
        upload = result.scalar_one_or_none()

        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")

        validations = []
        for val in upload.validations:
            validations.append(
                {
                    "id": val.id,
                    "is_valid": val.is_valid,
                    "errors": val.errors,
                    "warnings": val.warnings,
                    "validated_at": val.validated_at.isoformat()
                    if val.validated_at
                    else None,
                    "duration_ms": val.duration_ms,
                }
            )

        return {
            "id": upload.id,
            "session_id": upload.session_id,
            "filename": upload.filename,
            "json_content": upload.json_content,
            "uploaded_at": upload.uploaded_at.isoformat()
            if upload.uploaded_at
            else None,
            "validations": validations,
        }


@router.get("/requests")
async def list_requests(
    session_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    status_code: Optional[int] = Query(None, alias="status"),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: str = Depends(verify_admin),
):
    """List HTTP requests with filtering."""
    async with database_module.async_session_maker() as session:
        offset = (page - 1) * limit

        # Build query
        stmt = select(Request).order_by(desc(Request.timestamp))

        if session_id:
            stmt = stmt.where(Request.session_id == session_id)
        if endpoint:
            stmt = stmt.where(Request.endpoint.contains(endpoint))
        if status_code:
            stmt = stmt.where(Request.response_status == status_code)
        if start:
            stmt = stmt.where(Request.timestamp >= start)
        if end:
            stmt = stmt.where(Request.timestamp <= end)

        stmt = stmt.offset(offset).limit(limit)

        result = await session.execute(stmt)
        requests = result.scalars().all()

        request_list = []
        for req in requests:
            request_list.append(
                {
                    "id": req.id,
                    "session_id": req.session_id,
                    "endpoint": req.endpoint,
                    "method": req.method,
                    "response_status": req.response_status,
                    "error_message": req.error_message,
                    "duration_ms": req.duration_ms,
                    "container_hostname": req.container_hostname,
                    "timestamp": req.timestamp.isoformat() if req.timestamp else None,
                    "request_payload": req.request_payload,
                }
            )

        # Get total count
        count_stmt = select(func.count()).select_from(Request)
        if session_id:
            count_stmt = count_stmt.where(Request.session_id == session_id)
        if endpoint:
            count_stmt = count_stmt.where(Request.endpoint.contains(endpoint))
        if status_code:
            count_stmt = count_stmt.where(Request.response_status == status_code)
        if start:
            count_stmt = count_stmt.where(Request.timestamp >= start)
        if end:
            count_stmt = count_stmt.where(Request.timestamp <= end)

        total = await session.scalar(count_stmt)

        return {
            "requests": request_list,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }


@router.get("/roms")
async def list_roms(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: str = Depends(verify_admin),
):
    """List unique ROMs."""
    async with database_module.async_session_maker() as session:
        offset = (page - 1) * limit

        stmt = (
            select(Rom)
            .where(Rom.deleted_at.is_(None))
            .order_by(desc(Rom.last_seen_at))
            .offset(offset)
            .limit(limit)
        )

        result = await session.execute(stmt)
        roms = result.scalars().all()

        rom_list = []
        for rom in roms:
            session_count = await session.scalar(
                select(func.count())
                .select_from(SessionModel)
                .where(SessionModel.rom_md5 == rom.md5_hash)
            )

            rom_list.append(
                {
                    "md5_hash": rom.md5_hash,
                    "edition": rom.edition,
                    "size_bytes": rom.size_bytes,
                    "team_counts": {
                        "national": rom.team_count_national,
                        "club": rom.team_count_club,
                        "custom": rom.team_count_custom,
                    },
                    "first_seen_at": rom.first_seen_at.isoformat()
                    if rom.first_seen_at
                    else None,
                    "last_seen_at": rom.last_seen_at.isoformat()
                    if rom.last_seen_at
                    else None,
                    "session_count": session_count,
                }
            )

        total = await session.scalar(
            select(func.count()).select_from(Rom).where(Rom.deleted_at.is_(None))
        )

        return {
            "roms": rom_list,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }


@router.delete("/roms/{md5_hash}")
async def delete_rom(md5_hash: str, admin: str = Depends(verify_admin)):
    """Mark ROM for deletion (actual cleanup happens via cronjob)."""
    from backend.models.database import CleanupLog
    import backend.storage.local as storage_module

    async with database_module.async_session_maker() as session:
        rom = await session.get(Rom, md5_hash)
        if not rom:
            raise HTTPException(status_code=404, detail="ROM not found")

        # Mark as deleted
        rom.deleted_at = datetime.utcnow()

        # Log cleanup
        cleanup = CleanupLog(
            rom_md5=md5_hash, file_path=rom.storage_path, reason="manual_delete"
        )
        session.add(cleanup)

        await session.commit()

        # Try to delete file immediately
        deleted = await storage_module.rom_storage.delete_rom(md5_hash)

        return {
            "message": "ROM marked for deletion",
            "md5_hash": md5_hash,
            "file_deleted": deleted,
        }
