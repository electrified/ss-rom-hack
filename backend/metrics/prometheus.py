"""Prometheus metrics endpoint."""

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from fastapi import Response, APIRouter

router = APIRouter()

# Counters
REQUESTS_TOTAL = Counter(
    "ss_requests_total", "Total requests", ["endpoint", "method", "status"]
)

UPLOADS_TOTAL = Counter("ss_uploads_total", "Total JSON uploads", ["edition"])

VALIDATIONS_FAILED_TOTAL = Counter(
    "ss_validations_failed_total", "Total validation failures"
)

SESSIONS_CREATED_TOTAL = Counter(
    "ss_sessions_created_total", "Total sessions created", ["edition"]
)

# Gauges
ACTIVE_SESSIONS = Gauge("ss_active_sessions", "Current active sessions in Redis")

ROM_STORAGE_BYTES = Gauge("ss_rom_storage_bytes", "Total ROM storage used in bytes")

UNIQUE_ROMS = Gauge("ss_unique_roms", "Number of unique ROMs stored")

# Histograms
REQUEST_DURATION = Histogram(
    "ss_request_duration_seconds",
    "Request duration in seconds",
    ["endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

VALIDATION_DURATION = Histogram(
    "ss_validation_duration_seconds",
    "Validation duration in seconds",
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)


@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


def record_request(endpoint: str, method: str, status: int):
    """Record a request."""
    REQUESTS_TOTAL.labels(endpoint=endpoint, method=method, status=str(status)).inc()


def record_upload(edition: str):
    """Record an upload."""
    UPLOADS_TOTAL.labels(edition=edition).inc()


def record_validation_failure():
    """Record a validation failure."""
    VALIDATIONS_FAILED_TOTAL.inc()


def record_session_created(edition: str):
    """Record a session creation."""
    SESSIONS_CREATED_TOTAL.labels(edition=edition).inc()


def set_active_sessions(count: int):
    """Set active sessions gauge."""
    ACTIVE_SESSIONS.set(count)


def set_rom_storage_bytes(size: int):
    """Set ROM storage gauge."""
    ROM_STORAGE_BYTES.set(size)


def set_unique_roms(count: int):
    """Set unique ROMs gauge."""
    UNIQUE_ROMS.set(count)
