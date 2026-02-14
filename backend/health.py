"""Health check endpoints for Kubernetes probes."""

from fastapi import APIRouter, HTTPException, status

from backend.models.database import engine
from backend.models.redis import redis_store

router = APIRouter()

# Startup check state
_startup_complete = False


def set_startup_complete():
    """Mark startup as complete (called after migrations)."""
    global _startup_complete
    _startup_complete = True


@router.get("/health/live")
async def liveness_probe():
    """Liveness probe - app is running."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe():
    """Readiness probe - app is ready to serve traffic."""
    checks = {
        "database": False,
        "redis": False,
    }

    # Check database
    try:
        if engine:
            async with engine.connect() as conn:
                await conn.execute("SELECT 1")
            checks["database"] = True
    except Exception:
        pass

    # Check Redis
    try:
        if redis_store and redis_store.client:
            await redis_store.client.ping()
            checks["redis"] = True
    except Exception:
        pass

    # Check if all required services are up
    all_ready = all(checks.values())

    if not all_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "not_ready",
                "checks": checks,
            },
        )

    return {
        "status": "ready",
        "checks": checks,
    }


@router.get("/health/startup")
async def startup_probe():
    """Startup probe - app has finished initialization."""
    if not _startup_complete:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "starting"},
        )

    return {"status": "started"}
