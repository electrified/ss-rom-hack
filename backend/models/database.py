"""SQLAlchemy database models for persistent audit logging."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Boolean,
    Text,
    JSON,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship
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
    storage_path = Column(String(500), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), default=func.now())
    last_seen_at = Column(DateTime(timezone=True), default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="rom")


class Session(Base):
    """Session audit record - actual session state is in Redis."""

    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)
    rom_md5 = Column(String(32), ForeignKey("roms.md5_hash"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    container_hostname = Column(String(100))

    # Relationships
    rom = relationship("Rom", back_populates="sessions")
    uploads = relationship(
        "Upload", back_populates="session", cascade="all, delete-orphan"
    )
    requests = relationship(
        "Request", back_populates="session", cascade="all, delete-orphan"
    )


class Upload(Base):
    """JSON file uploads with full content."""

    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    filename = Column(String(255))
    json_content = Column(JSONB, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=func.now())

    # Relationships
    session = relationship("Session", back_populates="uploads")
    validations = relationship(
        "Validation", back_populates="upload", cascade="all, delete-orphan"
    )


class Validation(Base):
    """Validation results for each upload."""

    __tablename__ = "validations"

    id = Column(Integer, primary_key=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"), nullable=False)
    is_valid = Column(Boolean, nullable=False)
    errors = Column(JSONB, default=list)
    warnings = Column(JSONB, default=list)
    validated_at = Column(DateTime(timezone=True), default=func.now())
    duration_ms = Column(Integer)

    # Relationships
    upload = relationship("Upload", back_populates="validations")


class Request(Base):
    """HTTP request audit log."""

    __tablename__ = "requests"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    request_payload = Column(JSONB)
    response_status = Column(Integer)
    error_message = Column(Text)
    duration_ms = Column(Integer)
    container_hostname = Column(String(100))
    timestamp = Column(DateTime(timezone=True), default=func.now())

    # Relationships
    session = relationship("Session", back_populates="requests")

    # Indexes
    __table_args__ = (
        Index("idx_requests_session", "session_id"),
        Index("idx_requests_timestamp", "timestamp"),
        Index("idx_requests_status", "response_status"),
    )


class CleanupLog(Base):
    """Log of ROM file cleanup operations."""

    __tablename__ = "cleanup_log"

    id = Column(Integer, primary_key=True)
    rom_md5 = Column(String(32))
    file_path = Column(String(500))
    deleted_at = Column(DateTime(timezone=True), default=func.now())
    reason = Column(String(50))


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
