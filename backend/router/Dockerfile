# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies 
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Note: Certificates should be mounted as a volume at runtime

# Install dependencies 
RUN pip install "mcp[docker]" mcp fastapi uvicorn httpx openai-harmony sse-starlette python-multipart websockets

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
#   -e EMBEDDINGS_URL=https://embeddings.geist.im \
#   alo42/router:latest

# SSL/HTTPS mode with mounted certificates:
# docker run -d \
#   --name router-server \
#   -p 80:8000 \
#   -p 443:8443 \
#   -e INFERENCE_URL=https://inference.geist.im \
#   -e EMBEDDINGS_URL=https://embeddings.geist.im \
#   -e SSL_ENABLED=true \
#   -e SSL_CERT_PATH=/app/certificates/cert.pem \
#   -e SSL_KEY_PATH=/app/certificates/key.pem \
#   -e API_PORT=8443 \
#   -v /root/certificates:/app/certificates:ro \
#   alo42/router:latest