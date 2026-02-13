import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Optional

SESSION_TTL_SECONDS = 30 * 60
CLEANUP_INTERVAL_SECONDS = 5 * 60


@dataclass
class RomSession:
    rom_bytes: bytes
    created_at: float
    last_access: float


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, RomSession] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    def create(self, rom_bytes: bytes) -> str:
        session_id = str(uuid.uuid4())
        now = time.time()
        self._sessions[session_id] = RomSession(
            rom_bytes=rom_bytes,
            created_at=now,
            last_access=now,
        )
        return session_id

    def get(self, session_id: str) -> Optional[bytes]:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        session.last_access = time.time()
        return session.rom_bytes

    def delete(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def _cleanup_expired(self):
        now = time.time()
        expired = [
            sid
            for sid, sess in self._sessions.items()
            if now - sess.last_access > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            del self._sessions[sid]

    async def start_cleanup_task(self):
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            self._cleanup_expired()

    def start(self):
        self._cleanup_task = asyncio.create_task(self.start_cleanup_task())

    def stop(self):
        if self._cleanup_task:
            self._cleanup_task.cancel()


session_store = SessionStore()
