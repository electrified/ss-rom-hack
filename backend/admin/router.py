"""Admin API endpoints with basic authentication."""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, desc

from backend.models.database import Validation
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
        day_ago = datetime.utcnow() - timedelta(days=1)
        week_ago = datetime.utcnow() - timedelta(days=7)
        month_ago = datetime.utcnow() - timedelta(days=30)

        validations_24h = await session.scalar(
            select(func.count())
            .select_from(Validation)
            .where(Validation.validated_at >= day_ago)
        )
        validations_7d = await session.scalar(
            select(func.count())
            .select_from(Validation)
            .where(Validation.validated_at >= week_ago)
        )
        validations_30d = await session.scalar(
            select(func.count())
            .select_from(Validation)
            .where(Validation.validated_at >= month_ago)
        )

        validation_failures_24h = await session.scalar(
            select(func.count())
            .select_from(Validation)
            .where(Validation.validated_at >= day_ago, Validation.is_valid == False)
        )

        return {
            "uploads": {
                "24h": validations_24h,
                "7d": validations_7d,
                "30d": validations_30d,
            },
            "validations": {
                "failures_24h": validation_failures_24h,
            },
        }


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: int, admin: str = Depends(verify_admin)):
    """Get validation details including full JSON content."""
    async with database_module.async_session_maker() as session:
        result = await session.get(Validation, upload_id)

        if not result:
            raise HTTPException(status_code=404, detail="Validation not found")

        return {
            "id": result.id,
            "session_id": result.session_id,
            "filename": result.filename,
            "json_content": result.json_content,
            "is_valid": result.is_valid,
            "errors": result.errors,
            "warnings": result.warnings,
            "validated_at": result.validated_at.isoformat()
            if result.validated_at
            else None,
            "duration_ms": result.duration_ms,
        }


@router.get("/uploads")
async def list_uploads(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: str = Depends(verify_admin),
):
    """List all validations."""
    async with database_module.async_session_maker() as session:
        offset = (page - 1) * limit

        stmt = (
            select(Validation)
            .order_by(desc(Validation.validated_at))
            .offset(offset)
            .limit(limit)
        )

        result = await session.execute(stmt)
        validations = result.scalars().all()

        validation_list = []
        for val in validations:
            validation_list.append(
                {
                    "id": val.id,
                    "session_id": val.session_id,
                    "filename": val.filename,
                    "is_valid": val.is_valid,
                    "validated_at": val.validated_at.isoformat()
                    if val.validated_at
                    else None,
                }
            )

        total = await session.scalar(select(func.count()).select_from(Validation))

        return {
            "uploads": validation_list,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit if total else 1,
        }
