# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies 
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY main.py .
COPY config.py .
COPY harmony_service.py .

# Copy certificates directory (if it exists)
COPY certificates/ ./certificates/

# Install dependencies 
RUN pip install fastapi uvicorn httpx openai-harmony sse-starlette

# Create non-root user
RUN useradd -m -u 1000 router && chown -R router:router /app
USER router

# Expose ports (8000 for HTTP, 8443 for HTTPS)
EXPOSE 8000 8443

# Start command - use Python script to handle SSL configuration
CMD ["python", "main.py"]

# Example Docker run commands:

# HTTP mode (default):
# docker run -d \
#   --name router-server \
#   -p 80:8000 \
#   -e INFERENCE_URL=https://inference.geist.im \
#   -e EMBEDDER_URL=https://embedder.geist.im \
#   alo42/router:latest

## SSL/HTTPS mode:
# docker run -d \
#   --name router-server \
#   -p 80:8000 \
#   -p 443:8443 \
#   -e INFERENCE_URL=https://inference.geist.im \
#   -e EMBEDDER_URL=https://embedder.geist.im \
#   -e SSL_ENABLED=true \
#   -e SSL_CERT_PATH=/app/certificates/cert.pem \
#   -e SSL_KEY_PATH=/app/certificates/key.pem \
#   -e API_PORT=8443 \
#   alo42/router:latest