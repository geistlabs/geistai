"""
Database package for ORM-based data management
"""

import os

from .database import (
    get_db,
    get_db_session,
    init_database,
    test_connection,
    create_tables,
    drop_tables,
    create_initial_data
)
from .models import (
    Base,
    Conversation,
    ConversationResponse,
    ConversationResponseEvaluation
)

# Define DATABASE_URL directly to avoid import issues
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5433/test-storage"
)

__all__ = [
    "get_db",
    "get_db_session", 
    "init_database",
    "test_connection",
    "create_tables",
    "drop_tables",
    "create_initial_data",
    "Base",
    "Conversation",
    "ConversationResponse",
    "ConversationResponseEvaluation"
]
