"""HTTP request logging middleware for audit trail."""

import json
import time
import os
import asyncio
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.models.database import Request as RequestLog


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all HTTP requests to database and stdout."""

    def __init__(self, app, skip_paths: Optional[list] = None):
        super().__init__(app)
        self.skip_paths = skip_paths or ["/health", "/metrics"]
        self.hostname = os.getenv("HOSTNAME", "unknown")

    async def dispatch(self, request: Request, call_next):
        # Skip logging for health/metrics endpoints
        if any(request.url.path.startswith(path) for path in self.skip_paths):
            return await call_next(request)

        start_time = time.time()

        # Capture request body
        body = await self._get_request_body(request)

        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code
            error_msg = None
        except Exception as e:
            status_code = 500
            error_msg = str(e)
            raise
        finally:
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Get session ID from request
            session_id = self._get_session_id(request, body)

            # Build log entry
            log_entry = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "level": "ERROR" if status_code >= 400 else "INFO",
                "session_id": session_id,
                "endpoint": request.url.path,
                "method": request.method,
                "status": status_code,
                "duration_ms": duration_ms,
                "container": self.hostname,
                "payload_size": len(body) if body else 0,
            }

            if error_msg:
                log_entry["error"] = error_msg

            # Log to stdout (JSON format)
            print(json.dumps(log_entry), flush=True)

            # Async log to database
            asyncio.create_task(
                self._save_to_database(
                    session_id=session_id,
                    endpoint=request.url.path,
                    method=request.method,
                    payload=self._parse_json(body) if body else None,
                    status=status_code,
                    error=error_msg,
                    duration=duration_ms,
                )
            )

        return response

    async def _get_request_body(self, request: Request) -> bytes:
        """Capture request body."""
        body = await request.body()
        return body

    def _get_session_id(self, request: Request, body: bytes) -> Optional[str]:
        """Extract session ID from request."""
        # Try header first
        session_id = request.headers.get("X-Session-ID")
        if session_id:
            return session_id

        # Try query param
        session_id = request.query_params.get("session_id")
        if session_id:
            return session_id

        # Try JSON body (only for text/JSON content, not binary)
        if body:
            try:
                # Only try to parse if content-type suggests JSON
                content_type = request.headers.get("content-type", "")
                if "application/json" in content_type:
                    data = json.loads(body)
                    return data.get("session_id")
            except (json.JSONDecodeError, AttributeError, UnicodeDecodeError):
                # Binary data or non-JSON content
                pass

        return None

    def _parse_json(self, body: bytes) -> Optional[dict]:
        """Parse JSON body."""
        if not body:
            return None
        try:
            return json.loads(body)
        except (json.JSONDecodeError, TypeError, UnicodeDecodeError):
            # Binary data or invalid JSON
            return None

    async def _save_to_database(
        self,
        session_id: Optional[str],
        endpoint: str,
        method: str,
        payload: Optional[dict],
        status: int,
        error: Optional[str],
        duration: int,
    ):
        """Save request log to database."""
        try:
            # Import here to avoid circular imports and ensure db is initialized
            from backend.models.database import async_session_maker

            if async_session_maker is None:
                print("Database not initialized, skipping request log", flush=True)
                return

            async with async_session_maker() as db_session:
                log_entry = RequestLog(
                    session_id=session_id,
                    endpoint=endpoint,
                    method=method,
                    request_payload=payload,
                    response_status=status,
                    error_message=error,
                    duration_ms=duration,
                    container_hostname=self.hostname,
                )
                db_session.add(log_entry)
                await db_session.commit()
        except Exception as e:
            # Log failure - don't crash the request
            print(f"Failed to save request log: {e}", flush=True)
