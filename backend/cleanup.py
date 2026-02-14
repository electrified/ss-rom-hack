"""ROM cleanup script - delete old ROM files."""

import asyncio
import os
from datetime import datetime, timedelta

from sqlalchemy import select

from backend.models.database import init_database, Rom, CleanupLog
import backend.models.database as database_module
from backend.storage.local import init_storage
import backend.storage.local as storage_module


async def cleanup_old_roms(retention_days: int = 30):
    """Delete ROM files where sessions expired > retention_days ago."""
    from backend.models.database import Session as SessionModel

    cutoff = datetime.utcnow() - timedelta(days=retention_days)

    print(
        f"Starting cleanup of ROMs older than {retention_days} days (before {cutoff.isoformat()})"
    )

    async with database_module.async_session_maker() as session:
        # Find ROMs with no recent sessions
        stmt = (
            select(Rom)
            .where(Rom.deleted_at.is_(None))
            .where(
                ~select(SessionModel)
                .where(
                    SessionModel.rom_md5 == Rom.md5_hash,
                    SessionModel.expires_at > cutoff,
                )
                .exists()
            )
            .where(Rom.last_seen_at < cutoff)
        )

        result = await session.execute(stmt)
        old_roms = result.scalars().all()

        print(f"Found {len(old_roms)} ROMs to clean up")

        deleted_count = 0
        failed_count = 0

        for rom in old_roms:
            try:
                # Delete file
                deleted = await storage_module.rom_storage.delete_rom(rom.md5_hash)

                # Mark as deleted in database
                rom.deleted_at = datetime.utcnow()

                # Log cleanup
                cleanup = CleanupLog(
                    rom_md5=rom.md5_hash,
                    file_path=rom.storage_path,
                    reason=f"expired_{retention_days}d",
                )
                session.add(cleanup)

                if deleted:
                    print(f"✓ Deleted ROM {rom.md5_hash} from {rom.storage_path}")
                    deleted_count += 1
                else:
                    print(f"⚠ ROM file not found: {rom.storage_path}")

            except Exception as e:
                print(f"✗ Failed to delete ROM {rom.md5_hash}: {e}")
                failed_count += 1

        await session.commit()

        print(f"\nCleanup complete:")
        print(f"  - Deleted: {deleted_count}")
        print(f"  - Failed: {failed_count}")

        return deleted_count, failed_count


async def main():
    """Main entry point for cleanup script."""
    # Get retention days from environment
    retention_days = int(os.getenv("ROM_RETENTION_DAYS", "30"))

    # Initialize database
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not set")
        return 1

    await init_database(database_url)

    # Initialize storage
    storage_path = os.getenv("STORAGE_PATH", "/data/roms")
    init_storage(storage_path)

    # Run cleanup
    try:
        deleted, failed = await cleanup_old_roms(retention_days)
        return 0 if failed == 0 else 1
    except Exception as e:
        print(f"Cleanup failed: {e}")
        return 1
    finally:
        from backend.models.database import close_database

        await close_database()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
