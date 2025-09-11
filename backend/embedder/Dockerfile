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

# Copy certificates directory (if it exists)
COPY certificates/ ./certificates/

# Create models directory for caching
RUN mkdir -p /app/models

# Install dependencies (CPU-only PyTorch for smaller image size)
RUN pip install --no-cache-dir fastapi uvicorn sentence-transformers numpy pydantic && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Create non-root user
RUN useradd -m -u 1000 embedder && chown -R embedder:embedder /app
USER embedder

# Expose ports (8001 for HTTP, 8443 for HTTPS)
EXPOSE 8001 8443

# Start command - use Python script to handle SSL configuration
CMD ["python", "main.py"]

# Example usage:

# HTTP mode (default):
# docker run -d \
#   --name embedder-server \
#   -p 80:8001 \
#   -v embedder-models:/app/models \
#   alo42/embedder:latest

# SSL/HTTPS mode:
# docker run -d \
#   --name embedder-server \
#   -p 80:8001 \
#   -p 443:8443 \
#   -e SSL_ENABLED=true \
#   -e SSL_CERT_PATH=/app/certificates/cert.pem \
#   -e SSL_KEY_PATH=/app/certificates/key.pem \
#   -e API_PORT=8443 \
#   -v embedder-models:/app/models \
#   alo42/embedder:latest
