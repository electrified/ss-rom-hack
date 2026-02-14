"""Remove storage_path, sessions, and cleanup_log tables.

Revision ID: 002
Revises: 001
Create Date: 2026-02-14 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
