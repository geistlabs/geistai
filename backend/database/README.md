# Database ORM System

This directory contains the Python-based ORM system that replaces the SQL schema files with SQLAlchemy models.

## Overview

The database system uses SQLAlchemy ORM to define database models in Python, providing:
- Type-safe database operations
- Automatic schema management
- Easy migrations
- Python-native data access

## Files

- `models.py` - SQLAlchemy model definitions
- `database.py` - Database connection and session management
- `init_db.py` - Database initialization script
- `migrate.py` - Alembic migration management script
- `alembic.ini` - Alembic configuration
- `migrations/` - Alembic migration files directory
- `pyproject.toml` - Project configuration and dependencies
- `Dockerfile` - Docker container for database initialization

## Models

### Core Models

1. **Conversation** - Stores conversation data as JSON
2. **ConversationResponse** - Stores AI responses with evaluation metrics
3. **ConversationResponseEvaluation** - Detailed evaluation data for responses

## Setup

### 1. Create and Activate Virtual Environment

```bash
cd backend/database
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Linux/Mac:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -e .
```

### 3. Set Environment Variables

```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5433/test-storage"
export DB_ECHO="false"  # Set to "true" for SQL query logging
```

### 4. Initialize Database

```bash
python init_db.py
```

### 5. Database Migrations

```bash
# Activate venv first
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Create a new migration
python migrate.py create "Add new table"

# Upgrade to latest
python migrate.py upgrade

# Show current revision
python migrate.py current

# Show migration history
python migrate.py history
```

## Usage

### Basic Database Operations

```python
from database import get_db_session, Conversation, ConversationResponse, ConversationResponseEvaluation

# Create a new conversation
with get_db_session() as db:
    conversation = Conversation(
        conversation_json={"messages": [{"role": "user", "content": "Hello"}]}
    )
    db.add(conversation)
    # Session automatically commits on context exit

# Query conversations
with get_db_session() as db:
    conversations = db.query(Conversation).all()
    conversation = db.query(Conversation).filter(Conversation.internal_id == 1).first()
```

### FastAPI Integration

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db

@app.get("/conversations/")
def get_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).all()
```

### Conversation Management

```python
from database import get_db_session, Conversation, ConversationResponse, ConversationResponseEvaluation

# Create a conversation
with get_db_session() as db:
    conversation = Conversation(
        conversation_json={
            "messages": [
                {"role": "user", "content": "Tell me about space exploration"},
                {"role": "assistant", "content": "Space exploration is the investigation..."}
            ]
        }
    )
    db.add(conversation)
    
    # Add a response with evaluation
    response = ConversationResponse(
        response="Space exploration is the investigation...",
        evaluation=0.85,
        rationality=0.90,
        coherency=0.80,
        elapsed_time=1.5
    )
    db.add(response)
    
    # Add detailed evaluation
    evaluation = ConversationResponseEvaluation(
        conversation_json=conversation.conversation_json,
        elapsed=1.5,
        rationality=0.90,
        coherency=0.80
    )
    db.add(evaluation)
```

## Migration from SQL Schema

The old SQL schema files have been replaced with Python models. The benefits include:

1. **Type Safety** - Python type hints for all database fields
2. **Automatic Schema** - Tables created automatically from models
3. **Easy Queries** - Python-native query syntax
4. **Relationships** - Automatic foreign key handling
5. **Validation** - Built-in data validation

## Environment Configuration

The database connection is configured via environment variables:

- `DATABASE_URL` - Full database connection string
- `DB_ECHO` - Enable SQL query logging (true/false)

Default connection string:
```
postgresql://postgres:password@localhost:5433/test-storage
```

## Docker Integration

The Docker Compose configuration has been updated to remove SQL schema file mounting. The database is now initialized using the Python ORM system with Alembic migrations.

### Docker Compose Commands

**Start database and initialize:**
```bash
# Start PostgreSQL
docker-compose -f docker-compose.chris.yml up postgresdb -d

# Initialize database with migrations
docker-compose -f docker-compose.chris.yml --profile init up db-init
```

**Run migrations in Docker:**
```bash
# Build and run migration container
docker-compose -f docker-compose.chris.yml build db-init
docker-compose -f docker-compose.chris.yml run --rm db-init python migrate.py upgrade
```

### Database Service Configuration

The `db-init` service:
- Builds from the `database/Dockerfile`
- Connects to the `postgresdb` service
- Runs Alembic migrations automatically
- Uses the `init` profile to run only when needed

## Testing

### Test Database Connection

```bash
# Activate venv first
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Test connection
python -c "from database import test_connection; test_connection()"
```

## Troubleshooting

### Virtual Environment Issues
- Ensure Python 3.11+ is installed
- Check that `python -m venv` works
- Verify virtual environment activation
- Make sure to activate venv before running scripts
- Use `pip install -e .` to install the package in development mode

### Connection Issues
- Verify PostgreSQL is running on port 5433
- Check database credentials in environment variables
- Ensure the `test-storage` database exists

### Migration Issues
- Run `python init_db.py` to recreate tables
- Check database permissions
- Verify SQLAlchemy version compatibility

### Performance
- Use connection pooling (already configured)
- Consider adding database indexes for frequently queried fields
- Monitor query performance with `DB_ECHO=true`
