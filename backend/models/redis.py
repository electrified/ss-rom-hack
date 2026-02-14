"""Redis client for ephemeral session cache."""

import json
import pickle
from typing import Optional, Dict, Any
import redis.asyncio as redis


class RedisSessionStore:
    """Redis-based session store with TTL."""

    def __init__(self, redis_url: str, ttl_seconds: int = 1800):
        self.redis_url = redis_url
        self.ttl = ttl_seconds
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        """Connect to Redis."""
        self.client = await redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=False,  # We use pickle for serialization
        )

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.client:
            await self.client.close()

    async def create_session(
        self,
        session_id: str,
        rom_md5: str,
        teams_data: Dict[str, Any],
        rom_bytes: bytes,
    ) -> str:
        """Create a new session in Redis."""
        session_data = {
            "rom_md5": rom_md5,
            "teams_data": teams_data,
            "rom_bytes": rom_bytes,
        }

        await self.client.setex(
            f"session:{session_id}", self.ttl, pickle.dumps(session_data)
        )

        return session_id

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data from Redis."""
        data = await self.client.get(f"session:{session_id}")
        if data:
            return pickle.loads(data)
        return None

    async def extend_session(self, session_id: str):
        """Extend session TTL."""
        await self.client.expire(f"session:{session_id}", self.ttl)

    async def delete_session(self, session_id: str):
        """Delete a session."""
        await self.client.delete(f"session:{session_id}")

    async def get_active_sessions_count(self) -> int:
        """Get count of active sessions."""
        keys = await self.client.keys("session:*")
        return len(keys)

    async def health_check(self) -> bool:
        """Check Redis connectivity."""
        try:
            await self.client.ping()
            return True
        except Exception:
            return False


# Global instance (initialized in config)
redis_store: Optional[RedisSessionStore] = None


async def init_redis(redis_url: str, ttl_seconds: int = 1800):
    """Initialize Redis connection."""
    global redis_store
    redis_store = RedisSessionStore(redis_url, ttl_seconds)
    await redis_store.connect()


async def close_redis():
    """Close Redis connection."""
    if redis_store:
        await redis_store.disconnect()
