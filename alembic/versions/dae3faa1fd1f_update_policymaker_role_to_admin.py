"""Update policymaker role to admin

Revision ID: dae3faa1fd1f
Revises: 4b8f26d02683
Create Date: 2025-07-22 19:44:04.169834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dae3faa1fd1f'
down_revision: Union[str, Sequence[str], None] = '4b8f26d02683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Update existing policymaker roles to admin
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'policymaker'")


def downgrade() -> None:
    """Downgrade schema."""
    # Revert admin roles back to policymaker
    op.execute("UPDATE users SET role = 'policymaker' WHERE role = 'admin'")
