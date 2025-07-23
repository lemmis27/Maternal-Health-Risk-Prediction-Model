"""Convert emergency_contact to string properly

Revision ID: 4a6a4c66c8b8
Revises: dae3faa1fd1f
Create Date: 2025-07-22 20:22:40.004810

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a6a4c66c8b8'
down_revision: Union[str, Sequence[str], None] = 'dae3faa1fd1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # For SQLite, we need to recreate the table to change column type
    # First, create a temporary table with the new schema
    op.execute("""
        CREATE TABLE pregnant_mothers_temp (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            age INTEGER NOT NULL,
            gestational_age INTEGER,
            previous_pregnancies INTEGER DEFAULT 0,
            previous_complications TEXT,
            emergency_contact VARCHAR NOT NULL,
            assigned_chv_id VARCHAR,
            assigned_clinician_id VARCHAR,
            created_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_chv_id) REFERENCES users(id),
            FOREIGN KEY (assigned_clinician_id) REFERENCES users(id)
        )
    """)
    
    # Copy data from old table to new table, converting integer to string
    op.execute("""
        INSERT INTO pregnant_mothers_temp 
        SELECT id, user_id, age, gestational_age, previous_pregnancies, 
               previous_complications, CAST(emergency_contact AS TEXT), 
               assigned_chv_id, assigned_clinician_id, created_at
        FROM pregnant_mothers
    """)
    
    # Drop the old table
    op.execute("DROP TABLE pregnant_mothers")
    
    # Rename the temporary table
    op.execute("ALTER TABLE pregnant_mothers_temp RENAME TO pregnant_mothers")
    
    # Recreate the index
    op.execute("CREATE INDEX ix_pregnant_mothers_id ON pregnant_mothers (id)")


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse the process - convert string back to integer
    op.execute("""
        CREATE TABLE pregnant_mothers_temp (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            age INTEGER NOT NULL,
            gestational_age INTEGER,
            previous_pregnancies INTEGER DEFAULT 0,
            previous_complications TEXT,
            emergency_contact INTEGER NOT NULL,
            assigned_chv_id VARCHAR,
            assigned_clinician_id VARCHAR,
            created_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_chv_id) REFERENCES users(id),
            FOREIGN KEY (assigned_clinician_id) REFERENCES users(id)
        )
    """)
    
    # Copy data back, converting string to integer
    op.execute("""
        INSERT INTO pregnant_mothers_temp 
        SELECT id, user_id, age, gestational_age, previous_pregnancies, 
               previous_complications, CAST(emergency_contact AS INTEGER), 
               assigned_chv_id, assigned_clinician_id, created_at
        FROM pregnant_mothers
    """)
    
    # Drop the current table
    op.execute("DROP TABLE pregnant_mothers")
    
    # Rename the temporary table
    op.execute("ALTER TABLE pregnant_mothers_temp RENAME TO pregnant_mothers")
    
    # Recreate the index
    op.execute("CREATE INDEX ix_pregnant_mothers_id ON pregnant_mothers (id)")
