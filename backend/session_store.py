"""In-memory session store with TTL cleanup."""

import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Optional


@dataclass
class RomSession:
    rom_bytes: bytes
    created_at: float
    last_access: float


class SessionStore:
    def __init__(self, ttl_minutes: int = 30, cleanup_interval_minutes: int = 5):
        self._store: dict[str, RomSession] = {}
        self._ttl_seconds = ttl_minutes * 60
        self._cleanup_interval = cleanup_interval_minutes * 60
        self._cleanup_task: Optional[asyncio.Task] = None

    def create(self, rom_bytes: bytes) -> str:
        session_id = str(uuid.uuid4())
        now = time.time()
        self._store[session_id] = RomSession(
            rom_bytes=rom_bytes, created_at=now, last_access=now
        )
        return session_id

    def get(self, session_id: str) -> Optional[bytes]:
        session = self._store.get(session_id)
        if session is None:
            return None
        session.last_access = time.time()
        return session.rom_bytes

    def delete(self, session_id: str) -> bool:
        if session_id in self._store:
            del self._store[session_id]
            return True
        return False

    def _cleanup_expired(self):
        now = time.time()
        expired = [
            sid
            for sid, sess in self._store.items()
            if now - sess.last_access > self._ttl_seconds
        ]
        for sid in expired:
            del self._store[sid]

    async def start_cleanup_task(self):
        async def cleanup_loop():
            while True:
                await asyncio.sleep(self._cleanup_interval)
                self._cleanup_expired()

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    async def stop_cleanup_task(self):
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass


store = SessionStore()
