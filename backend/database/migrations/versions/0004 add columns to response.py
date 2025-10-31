"""Add first_token_time and num_tool_calls columns to conversation_response

Revision ID: 0004
Revises: 0003
Create Date: 2024-06-09 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add first_token_time (float) and num_tool_calls (integer) to conversation_response
    op.add_column('conversation_response', sa.Column('first_token_time', sa.Float(), nullable=True))
    op.add_column('conversation_response', sa.Column('num_tool_calls', sa.Integer(), nullable=True))

def downgrade() -> None:
    # Remove the two columns in downgrade
    op.drop_column('conversation_response', 'num_tool_calls')
    op.drop_column('conversation_response', 'first_token_time')

