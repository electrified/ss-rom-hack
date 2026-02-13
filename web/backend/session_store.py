"""In-memory session store with TTL cleanup."""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class Session:
    rom_bytes: bytes
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_access: datetime = field(default_factory=datetime.utcnow)


class SessionStore:
    """In-memory session store with automatic cleanup."""

    def __init__(self, ttl_minutes: int = 30, cleanup_interval: int = 5):
        self.sessions: dict[str, Session] = {}
        self.ttl = timedelta(minutes=ttl_minutes)
        self.cleanup_interval = cleanup_interval
        self._cleanup_task: Optional[asyncio.Task] = None

    def create(self, rom_bytes: bytes) -> str:
        """Create a new session and return the session ID."""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = Session(rom_bytes=rom_bytes)
        return session_id

    def get(self, session_id: str) -> Optional[bytes]:
        """Get ROM bytes for a session, updating last access time."""
        session = self.sessions.get(session_id)
        if session is None:
            return None

        # Check if expired
        if datetime.utcnow() - session.last_access > self.ttl:
            del self.sessions[session_id]
            return None

        session.last_access = datetime.utcnow()
        return session.rom_bytes

    def delete(self, session_id: str) -> bool:
        """Delete a session. Returns True if existed."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False

    def _cleanup_expired(self):
        """Remove expired sessions."""
        now = datetime.utcnow()
        expired = [
            sid
            for sid, session in self.sessions.items()
            if now - session.last_access > self.ttl
        ]
        for sid in expired:
            del self.sessions[sid]

    async def start_cleanup_task(self):
        """Start background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        """Background task to clean up expired sessions."""
        while True:
            await asyncio.sleep(self.cleanup_interval * 60)
            self._cleanup_expired()

    def stop_cleanup_task(self):
        """Stop background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None


# Global session store instance
session_store = SessionStore(ttl_minutes=30, cleanup_interval=5)
