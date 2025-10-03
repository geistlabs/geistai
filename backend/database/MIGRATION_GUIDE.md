# Database Migration Guide

This guide explains how to use Alembic migrations with the GeistAI database system.

## Overview

The database system uses Alembic for version-controlled database migrations. This allows you to:
- Track database schema changes over time
- Apply migrations in different environments
- Rollback changes if needed
- Collaborate on database changes with version control

## Migration Commands

### Basic Commands

**Create a new migration:**
```bash
# Activate venv first
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Create migration
python migrate.py create "Add user preferences table"
```

**Apply migrations:**
```bash
# Upgrade to latest
python migrate.py upgrade

# Upgrade to specific revision
python migrate.py upgrade 0002
```

**Check current status:**
```bash
# Show current revision
python migrate.py current

# Show migration history
python migrate.py history
```

**Rollback changes:**
```bash
# Downgrade one revision
python migrate.py downgrade -1

# Downgrade to specific revision
python migrate.py downgrade 0001
```

## Migration Workflow

### 1. Making Schema Changes

When you need to modify the database schema:

1. **Update the SQLAlchemy models** in `models.py`
2. **Create a migration** using Alembic's autogenerate feature
3. **Review the generated migration** file
4. **Apply the migration** to your database

### 2. Example: Adding a New Table

**Step 1: Update models.py**
```python
class UserPreferences(Base):
    __tablename__ = 'user_preferences'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    theme = Column(String(20), default='light')
    language = Column(String(10), default='en')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
```

**Step 2: Create migration**
```bash
python migrate.py create "Add user preferences table"
```

**Step 3: Review generated migration**
Check the generated file in `migrations/versions/` to ensure it's correct.

**Step 4: Apply migration**
```bash
python migrate.py upgrade
```

### 3. Example: Modifying Existing Table

**Step 1: Update models.py**
```python
class User(Base):
    # ... existing fields ...
    
    # Add new field
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Modify existing field
    email = Column(String(150), unique=True, index=True, nullable=False)  # Increased length
```

**Step 2: Create and apply migration**
```bash
python migrate.py create "Add last_login and extend email length"
python migrate.py upgrade
```

## Docker Integration

### Running Migrations in Docker

**Initialize database in Docker:**
```bash
# Start PostgreSQL
docker-compose -f docker-compose.chris.yml up postgresdb -d

# Run initial migration
docker-compose -f docker-compose.chris.yml --profile init up db-init
```

**Run specific migration commands:**
```bash
# Create migration in Docker
docker-compose -f docker-compose.chris.yml run --rm db-init python migrate.py create "Add new feature"

# Apply migrations in Docker
docker-compose -f docker-compose.chris.yml run --rm db-init python migrate.py upgrade
```

## Best Practices

### 1. Migration Naming

Use descriptive names for migrations:
```bash
# Good
python migrate.py create "Add user authentication fields"
python migrate.py create "Create conversation analytics table"

# Avoid
python migrate.py create "Update database"
python migrate.py create "Fix stuff"
```

### 2. Review Generated Migrations

Always review auto-generated migrations before applying:
- Check that the SQL operations are correct
- Ensure no data loss will occur
- Verify foreign key constraints are properly handled

### 3. Test Migrations

Test migrations in development before applying to production:
```bash
# Test upgrade
python migrate.py upgrade

# Test downgrade
python migrate.py downgrade -1

# Test upgrade again
python migrate.py upgrade
```

### 4. Backup Before Major Changes

For production deployments:
```bash
# Backup database before migration
pg_dump -h localhost -p 5433 -U postgres test-storage > backup_before_migration.sql

# Apply migration
python migrate.py upgrade

# Verify migration worked
python migrate.py current
```

## Troubleshooting

### Common Issues

**Migration conflicts:**
```bash
# Check current state
python migrate.py current

# Check history
python migrate.py history

# Resolve conflicts manually if needed
```

**Failed migration:**
```bash
# Check migration status
python migrate.py current

# Rollback if needed
python migrate.py downgrade -1

# Fix the migration file and try again
python migrate.py upgrade
```

**Database connection issues:**
- Verify PostgreSQL is running
- Check DATABASE_URL environment variable
- Ensure database exists and is accessible

### Manual Migration Fixes

If you need to manually fix a migration:

1. **Edit the migration file** in `migrations/versions/`
2. **Test the migration** in development
3. **Apply the fixed migration**
4. **Commit the changes** to version control

## Environment-Specific Migrations

### Development
```bash
# Local development
python migrate.py upgrade
```

### Docker Development
```bash
# Docker environment
docker-compose -f docker-compose.chris.yml run --rm db-init python migrate.py upgrade
```

### Production
```bash
# Production (with proper backup)
pg_dump -h production-host -U postgres test-storage > backup.sql
python migrate.py upgrade
```

## Migration File Structure

```
migrations/
├── env.py                 # Alembic environment configuration
├── script.py.mako        # Migration template
└── versions/             # Migration files
    ├── 0001_initial_migration.py
    ├── 0002_add_user_preferences.py
    └── 0003_update_conversation_table.py
```

Each migration file contains:
- `upgrade()` - Apply the migration
- `downgrade()` - Rollback the migration
- Revision identifiers for tracking

## Advanced Usage

### Custom Migration Scripts

For complex migrations that can't be auto-generated:

```python
def upgrade() -> None:
    # Custom SQL operations
    op.execute("UPDATE users SET status = 'active' WHERE status IS NULL")
    
    # Add new column
    op.add_column('users', sa.Column('status', sa.String(20), nullable=True))
    
    # Create index
    op.create_index('ix_users_status', 'users', ['status'])

def downgrade() -> None:
    # Reverse operations
    op.drop_index('ix_users_status', table_name='users')
    op.drop_column('users', 'status')
```

### Data Migrations

For migrating data during schema changes:

```python
def upgrade() -> None:
    # Add new column
    op.add_column('users', sa.Column('full_name', sa.String(200), nullable=True))
    
    # Migrate data
    connection = op.get_bind()
    connection.execute(
        "UPDATE users SET full_name = CONCAT(first_name, ' ', last_name)"
    )
    
    # Make column non-nullable
    op.alter_column('users', 'full_name', nullable=False)
```

This migration system provides a robust, version-controlled approach to database schema management that integrates seamlessly with the Docker Compose setup.
