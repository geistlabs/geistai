"""Add issues table related to conversation_response

Revision ID: 0002
Revises: 0001
Create Date: 2024-06-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create issues table with a many-to-one relationship to conversation_response
    op.create_table(
        'issue',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('conversation_response_id', sa.Integer(), sa.ForeignKey('conversation_response.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )
    op.create_index(op.f('ix_issue_conversation_response_id'), 'issue', ['conversation_response_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_issue_conversation_response_id'), table_name='issue')
    op.drop_table('issue')
