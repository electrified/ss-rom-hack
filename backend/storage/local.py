"""Shared storage abstraction for ROM files."""

import os
import hashlib
from pathlib import Path
from typing import Optional
import aiofiles


class RomStorage:
    """Local filesystem storage for ROM files."""

    def __init__(self, storage_path: str):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def get_rom_path(self, md5_hash: str) -> Path:
        """Get the storage path for a ROM file."""
        return self.storage_path / f"{md5_hash}.rom"

    async def save_rom(self, md5_hash: str, rom_bytes: bytes) -> Path:
        """Save ROM bytes to storage."""
        file_path = self.get_rom_path(md5_hash)

        # Write atomically
        temp_path = file_path.with_suffix(".tmp")
        async with aiofiles.open(temp_path, "wb") as f:
            await f.write(rom_bytes)

        # Atomic rename
        temp_path.rename(file_path)

        return file_path

    async def load_rom(self, md5_hash: str) -> Optional[bytes]:
        """Load ROM bytes from storage."""
        file_path = self.get_rom_path(md5_hash)

        if not file_path.exists():
            return None

        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()

    def rom_exists(self, md5_hash: str) -> bool:
        """Check if ROM file exists."""
        return self.get_rom_path(md5_hash).exists()

    async def delete_rom(self, md5_hash: str) -> bool:
        """Delete ROM file from storage."""
        file_path = self.get_rom_path(md5_hash)

        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def get_storage_size_bytes(self) -> int:
        """Get total storage used by ROM files."""
        total = 0
        for rom_file in self.storage_path.glob("*.rom"):
            total += rom_file.stat().st_size
        return total

    def list_roms(self):
        """List all stored ROM files."""
        roms = []
        for rom_file in self.storage_path.glob("*.rom"):
            stat = rom_file.stat()
            roms.append(
                {
                    "md5": rom_file.stem,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                }
            )
        return roms


# Global instance (initialized in config)
rom_storage: Optional[RomStorage] = None


def init_storage(storage_path: str):
    """Initialize storage."""
    global rom_storage
    rom_storage = RomStorage(storage_path)
