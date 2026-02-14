"""Initial database schema.

Revision ID: 001
Revises:
Create Date: 2025-01-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

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
        sa.Column(
            "first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Create validations table (merged with uploads)
    op.create_table(
        "validations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("filename", sa.String(255)),
        sa.Column("json_content", postgresql.JSONB, nullable=False),
        sa.Column("is_valid", sa.Boolean, nullable=False),
        sa.Column("errors", postgresql.JSONB, default=[]),
        sa.Column("warnings", postgresql.JSONB, default=[]),
        sa.Column(
            "validated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("duration_ms", sa.Integer),
    )

    # Create indexes
    op.create_index("idx_validations_session", "validations", ["session_id"])
    op.create_index("idx_roms_deleted", "roms", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("idx_roms_deleted")
    op.drop_index("idx_validations_session")
    op.drop_table("validations")
    op.drop_table("roms")
