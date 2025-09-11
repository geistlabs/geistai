# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies 
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY main.py .
COPY config.py .

# Create models directory for caching
RUN mkdir -p /app/models

# Install dependencies 
RUN pip install --no-cache-dir fastapi uvicorn sentence-transformers torch numpy pydantic

# Create non-root user
RUN useradd -m -u 1000 embedder && chown -R embedder:embedder /app
USER embedder

# Expose port
EXPOSE 8001

# Start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

# Example usage:
# docker run -d \
#   --name embedder-server \
#   -p 8001:8001 \
#   -v embedder-models:/app/models \
#   alo42/embedder:latest
