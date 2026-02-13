"""In-memory session store with TTL cleanup for ROM uploads."""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class Session:
    """A session containing ROM bytes and metadata."""

    rom_bytes: bytes
    created_at: float = field(default_factory=time.time)
    last_access: float = field(default_factory=time.time)


class SessionStore:
    """In-memory session store with automatic TTL cleanup."""

    def __init__(self, ttl_seconds: int = 1800, cleanup_interval: int = 300):
        """
        Initialize the session store.

        Args:
            ttl_seconds: Time-to-live for sessions in seconds (default 30 min)
            cleanup_interval: How often to run cleanup in seconds (default 5 min)
        """
        self._sessions: Dict[str, Session] = {}
        self._ttl = ttl_seconds
        self._cleanup_interval = cleanup_interval
        self._cleanup_task: Optional[asyncio.Task] = None

    def create_session(self, rom_bytes: bytes) -> str:
        """Create a new session and return the session ID."""
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = Session(rom_bytes=rom_bytes)
        return session_id

    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID, updating last_access time."""
        session = self._sessions.get(session_id)
        if session:
            session.last_access = time.time()
        return session

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if deleted, False if not found."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def _cleanup_expired(self) -> int:
        """Remove expired sessions. Returns count of removed sessions."""
        now = time.time()
        expired = [
            sid
            for sid, session in self._sessions.items()
            if now - session.last_access > self._ttl
        ]
        for sid in expired:
            del self._sessions[sid]
        return len(expired)

    async def _cleanup_loop(self):
        """Background task that periodically cleans up expired sessions."""
        while True:
            await asyncio.sleep(self._cleanup_interval)
            count = self._cleanup_expired()
            if count > 0:
                print(f"Cleaned up {count} expired sessions")

    def start_cleanup_task(self):
        """Start the background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    def stop_cleanup_task(self):
        """Stop the background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None


# Global instance
session_store = SessionStore()
