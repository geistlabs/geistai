# Testing Guide for GeistAI

This guide explains how to properly run tests in the GeistAI development environment.

## Prerequisites

### 1. Docker Environment Setup

Ensure your Docker environment is running:

```bash
# Check if services are running
docker-compose -f backend\docker-compose.chris.yml ps

# If not running, start the services
docker-compose -f backend\docker-compose.chris.yml up -d
```

### 2. Database Setup

The database must be initialized and migrations applied:

```bash
# Run database migrations (if not already done)
cd backend\database
.\venv\Scripts\activate
python migrate.py upgrade
```

## Running Tests

### Router Tests

The router tests require the database dependencies to be installed in the router's virtual environment.

#### 1. Activate Router Virtual Environment

```bash
cd backend\router
.\venv\Scripts\activate
```

#### 2. Install Database Dependencies (if not already installed)

```bash
pip install sqlalchemy psycopg2-binary alembic python-dateutil
```

#### 3. Run Tests

```bash
# Run conversation tests
python test_conversation.py

# Run other router tests
python test_health_endpoint.py
python test_streaming.py
python test_mcp.py
```

### Database Tests

#### 1. Activate Database Virtual Environment

```bash
cd backend\database
.\venv\Scripts\activate
```

#### 2. Run Database Tests

```bash
# Test database connection
python -c "from database import test_connection; print('Database OK' if test_connection() else 'Database Failed')"

# Run migrations
python migrate.py current
python migrate.py history
```

## Test Environment Variables

Ensure these environment variables are set:

```bash
# Database connection
DATABASE_URL=postgresql://postgres:password@localhost:5433/test-storage

# OpenAI API (for conversation tests)
OPENAI_KEY=your_openai_api_key_here

# Other service URLs
INFERENCE_URL=http://localhost:8080
EMBEDDINGS_URL=http://localhost:8001
```

## Troubleshooting

### Common Issues

#### 1. "No module named 'sqlalchemy'"

**Solution**: Install database dependencies in the router virtual environment:
```bash
cd backend\router
.\venv\Scripts\activate
pip install sqlalchemy psycopg2-binary alembic python-dateutil
```

#### 2. "Database connection failed"

**Solution**: Ensure PostgreSQL is running and accessible:
```bash
# Check if database container is running
docker ps | grep postgresdb

# Check database connectivity
docker exec backend-postgresdb-1 psql -U postgres -d test-storage -c "SELECT 1;"
```

#### 3. "Migration not found" or "Database schema out of date"

**Solution**: Run database migrations:
```bash
cd backend\database
.\venv\Scripts\activate
python migrate.py upgrade
```

#### 4. "OpenAI API key not found"

**Solution**: Ensure your `.env` file contains the OpenAI API key:
```bash
# Check if .env file exists and contains OPENAI_KEY
cat backend\.env | grep OPENAI_KEY
```

### Test-Specific Issues

#### Conversation Tests

- **Issue**: "can't adapt type 'dict'" error
- **Solution**: This indicates the database model fields don't match the test expectations. Ensure the test is using the correct field names from the updated models.

- **Issue**: "turn_index is an invalid keyword argument"
- **Solution**: The test is using outdated field names. Update the test to use the current model schema.

#### Database Tests

- **Issue**: "alembic command not found"
- **Solution**: Ensure alembic is installed in the database virtual environment:
```bash
cd backend\database
.\venv\Scripts\activate
pip install alembic
```

## Test Data Management

### Clearing Test Data

To clear test data between runs:

```bash
# Connect to database and clear test tables
docker exec -it backend-postgresdb-1 psql -U postgres -d test-storage -c "
DELETE FROM conversation_response_evaluation;
DELETE FROM conversation_response;
DELETE FROM conversation;
"
```

### Backup Test Data

To backup test data:

```bash
# Create backup
docker exec backend-postgresdb-1 pg_dump -U postgres test-storage > test_data_backup.sql

# Restore backup
docker exec -i backend-postgresdb-1 psql -U postgres test-storage < test_data_backup.sql
```

## Continuous Integration

For automated testing, use these commands in your CI pipeline:

```bash
# Start services
docker-compose -f backend\docker-compose.chris.yml up -d

# Wait for services to be ready
sleep 30

# Run database migrations
cd backend\database && .\venv\Scripts\activate && python migrate.py upgrade

# Run router tests
cd backend\router && .\venv\Scripts\activate && pip install sqlalchemy psycopg2-binary alembic python-dateutil && python test_conversation.py

# Cleanup
docker-compose -f backend\docker-compose.chris.yml down
```

## Best Practices

1. **Always activate virtual environments** before running tests
2. **Check service health** before running tests that depend on external services
3. **Use consistent database state** by running migrations before tests
4. **Clean up test data** between test runs to avoid conflicts
5. **Check logs** if tests fail to understand the root cause
6. **Use environment variables** for configuration instead of hardcoded values

## Test File Organization

- `backend/router/test_*.py` - Router service tests
- `backend/database/migrate.py` - Database migration management
- `backend/database/models.py` - Database models and relationships
- `backend/database/migrations/` - Database migration files

## Support

If you encounter issues not covered in this guide:

1. Check the service logs: `docker-compose -f backend\docker-compose.chris.yml logs [service_name]`
2. Verify all services are healthy: `docker-compose -f backend\docker-compose.chris.yml ps`
3. Check the database connection: `docker exec backend-postgresdb-1 psql -U postgres -d test-storage -c "SELECT version();"`
4. Review the migration status: `cd backend\database && .\venv\Scripts\activate && python migrate.py current`
