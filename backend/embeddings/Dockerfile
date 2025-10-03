# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies 
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy entire backend directory for cross-service package access
COPY ../.. /app/backend
WORKDIR /app/backend/embeddings

# Create models directory for caching
RUN mkdir -p /app/models

# Install dependencies (CPU-only PyTorch for smaller image size)
RUN pip install --no-cache-dir fastapi uvicorn sentence-transformers numpy pydantic && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install all backend packages in editable mode for cross-service access
RUN pip install -e /app/backend/router
RUN pip install -e /app/backend/database

# Set environment variables for cross-service package access
ENV PYTHONPATH=/app/backend:/app/backend/router:/app/backend/embeddings:/app/backend/database

# Create non-root user
RUN useradd -m -u 1000 embeddings && chown -R embeddings:embeddings /app
USER embeddings

# Expose port
EXPOSE 8001

# Start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

# Example usage:
# docker run -d \
#   --name embeddings-server \
#   -p 8001:8001 \
#   alo42/embeddings:latest
