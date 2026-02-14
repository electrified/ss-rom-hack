"""Initial database schema.

Revision ID: 001
Revises:
Create Date: 2025-01-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create roms table
    op.create_table(
        "roms",
        sa.Column("md5_hash", sa.String(32), primary_key=True),
        sa.Column("edition", sa.String(20), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("team_count_national", sa.Integer, default=0),
        sa.Column("team_count_club", sa.Integer, default=0),
        sa.Column("team_count_custom", sa.Integer, default=0),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column(
            "first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rom_md5", sa.String(32), sa.ForeignKey("roms.md5_hash"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("container_hostname", sa.String(100)),
    )

    # Create uploads table
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "session_id", sa.String(36), sa.ForeignKey("sessions.id"), nullable=False
        ),
        sa.Column("filename", sa.String(255)),
        sa.Column("json_content", postgresql.JSONB, nullable=False),
        sa.Column(
            "uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # Create validations table
    op.create_table(
        "validations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("upload_id", sa.Integer, sa.ForeignKey("uploads.id"), nullable=False),
        sa.Column("is_valid", sa.Boolean, nullable=False),
        sa.Column("errors", postgresql.JSONB, default=[]),
        sa.Column("warnings", postgresql.JSONB, default=[]),
        sa.Column(
            "validated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("duration_ms", sa.Integer),
    )

    # Create requests table
    op.create_table(
        "requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "session_id", sa.String(36), sa.ForeignKey("sessions.id"), nullable=True
        ),
        sa.Column("endpoint", sa.String(255), nullable=False),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("request_payload", postgresql.JSONB),
        sa.Column("response_status", sa.Integer),
        sa.Column("error_message", sa.Text),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("container_hostname", sa.String(100)),
        sa.Column(
            "timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # Create indexes
    op.create_index("idx_requests_session", "requests", ["session_id"])
    op.create_index("idx_requests_timestamp", "requests", ["timestamp"])
    op.create_index("idx_requests_status", "requests", ["response_status"])
    op.create_index("idx_uploads_session", "uploads", ["session_id"])
    op.create_index("idx_validations_upload", "validations", ["upload_id"])
    op.create_index("idx_roms_deleted", "roms", ["deleted_at"])

    # Create cleanup_log table
    op.create_table(
        "cleanup_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("rom_md5", sa.String(32)),
        sa.Column("file_path", sa.String(500)),
        sa.Column(
            "deleted_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("reason", sa.String(50)),
    )


def downgrade() -> None:
    op.drop_table("cleanup_log")
    op.drop_index("idx_roms_deleted")
    op.drop_index("idx_validations_upload")
    op.drop_index("idx_uploads_session")
    op.drop_index("idx_requests_status")
    op.drop_index("idx_requests_timestamp")
    op.drop_index("idx_requests_session")
    op.drop_table("requests")
    op.drop_table("validations")
    op.drop_table("uploads")
    op.drop_table("sessions")
    op.drop_table("roms")
