"""Relate conversation responses to conversations and evaluations to responses

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add foreign key from conversation_response to conversation
    # This creates a many-to-one relationship (many responses to one conversation)
    op.add_column('conversation_response', 
                  sa.Column('conversation_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_conversation_response_conversation_id', 
                         'conversation_response', 'conversation', 
                         ['conversation_id'], ['internal_id'], 
                         ondelete='CASCADE')
    op.create_index(op.f('ix_conversation_response_conversation_id'), 
                   'conversation_response', ['conversation_id'], unique=False)
    
    # Add foreign key from conversation_response_evaluation to conversation_response
    # This creates a one-to-one relationship (one evaluation to one response)
    op.add_column('conversation_response_evaluation', 
                  sa.Column('conversation_response_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_conversation_response_evaluation_response_id', 
                         'conversation_response_evaluation', 'conversation_response', 
                         ['conversation_response_id'], ['id'], 
                         ondelete='CASCADE')
    op.create_index(op.f('ix_conversation_response_evaluation_response_id'), 
                   'conversation_response_evaluation', ['conversation_response_id'], unique=False)


def downgrade() -> None:
    # Remove foreign keys and columns in reverse order
    op.drop_index(op.f('ix_conversation_response_evaluation_response_id'), 
                 table_name='conversation_response_evaluation')
    op.drop_constraint('fk_conversation_response_evaluation_response_id', 
                      'conversation_response_evaluation', type_='foreignkey')
    op.drop_column('conversation_response_evaluation', 'conversation_response_id')
    
    op.drop_index(op.f('ix_conversation_response_conversation_id'), 
                 table_name='conversation_response')
    op.drop_constraint('fk_conversation_response_conversation_id', 
                      'conversation_response', type_='foreignkey')
    op.drop_column('conversation_response', 'conversation_id')
