"""SQLAlchemy database models for persistent audit logging."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Boolean,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

Base = declarative_base()


class Rom(Base):
    """ROM metadata - unique by MD5 hash."""

    __tablename__ = "roms"

    md5_hash = Column(String(32), primary_key=True)
    edition = Column(String(20), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    team_count_national = Column(Integer, default=0)
    team_count_club = Column(Integer, default=0)
    team_count_custom = Column(Integer, default=0)
    first_seen_at = Column(DateTime(timezone=True), default=func.now())
    last_seen_at = Column(DateTime(timezone=True), default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class Validation(Base):
    """Validation results for each JSON upload."""

    __tablename__ = "validations"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(36), nullable=False, index=True)
    filename = Column(String(255))
    json_content = Column(JSONB, nullable=False)
    is_valid = Column(Boolean, nullable=False)
    errors = Column(JSONB, default=list)
    warnings = Column(JSONB, default=list)
    validated_at = Column(DateTime(timezone=True), default=func.now())
    duration_ms = Column(Integer)


# Database engine and session factory (initialized in config)
engine = None
async_session_maker = None


async def init_database(database_url: str):
    """Initialize database engine and session maker."""
    global engine, async_session_maker

    engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
        pool_size=20,
        max_overflow=0,
    )

    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session() -> AsyncSession:
    """Get a database session."""
    async with async_session_maker() as session:
        yield session


async def close_database():
    """Close database connections."""
    if engine:
        await engine.dispose()
