"""Initial migration - Simple schema

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create conversation table
    op.create_table('conversation',
        sa.Column('internal_id', sa.Integer(), nullable=False),
        sa.Column('conversation_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('internal_id')
    )
    op.create_index(op.f('ix_conversation_internal_id'), 'conversation', ['internal_id'], unique=False)

    # Create conversation_response table
    op.create_table('conversation_response',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('evaluation', sa.Float(), nullable=True),
        sa.Column('rationality', sa.Float(), nullable=True),
        sa.Column('coherency', sa.Float(), nullable=True),
        sa.Column('elapsed_time', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversation_response_id'), 'conversation_response', ['id'], unique=False)

    # Create conversation_response_evaluation table
    op.create_table('conversation_response_evaluation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_json', sa.JSON(), nullable=False),
        sa.Column('elapsed', sa.Float(), nullable=True),
        sa.Column('rationality', sa.Float(), nullable=True),
        sa.Column('coherency', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversation_response_evaluation_id'), 'conversation_response_evaluation', ['id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_conversation_response_evaluation_id'), table_name='conversation_response_evaluation')
    op.drop_table('conversation_response_evaluation')
    
    op.drop_index(op.f('ix_conversation_response_id'), table_name='conversation_response')
    op.drop_table('conversation_response')
    
    op.drop_index(op.f('ix_conversation_internal_id'), table_name='conversation')
    op.drop_table('conversation')
