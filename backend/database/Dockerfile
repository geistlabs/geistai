FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy entire backend directory for cross-service package access
COPY ../.. /app/backend
WORKDIR /app/backend/database

# Install dependencies directly (like router)
RUN pip install --no-cache-dir sqlalchemy psycopg2-binary alembic python-dateutil

# Install all backend packages in editable mode for cross-service access
RUN pip install -e /app/backend/router
RUN pip install -e /app/backend/embeddings

# Set environment variables for cross-service package access
ENV PYTHONPATH=/app/backend:/app/backend/router:/app/backend/embeddings:/app/backend/database
ENV DATABASE_URL=postgresql://postgres:password@postgresdb:5432/test-storage

# Default command
CMD ["python", "init_db.py"]
