# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the router directory contents
COPY . .

# Install dependencies from pyproject.toml
RUN pip install -e .

# Install additional MCP dependencies
RUN pip install "mcp[docker]" websockets

# Set environment variables for cross-service package access
ENV PYTHONPATH=/app:/app/router:/app/embeddings:/app/database

# Install dependencies
RUN pip install fastapi uvicorn httpx openai-harmony sse-starlette python-multipart beautifulsoup4 sentence-transformers tiktoken

# Create non-root user
RUN useradd -m -u 1000 router && chown -R router:router /app
USER router

# Expose ports (8000 for HTTP, 8443 for HTTPS)
EXPOSE 8000 8443

# Smart startup script that handles both contexts
COPY --chown=router:router <<EOF /app/start.sh
#!/bin/bash
# Smart startup script that works for both local and production contexts

# Check if main.py exists in current directory (/app)
if [ -f "/app/main.py" ]; then
    echo "Starting router from /app (production context)"
    cd /app
    exec python main.py
# Check if main.py exists in router subdirectory (/app/router)
elif [ -f "/app/router/main.py" ]; then
    echo "Starting router from /app/router (local context)"
    cd /app/router
    exec python main.py
else
    echo "Error: main.py not found in /app or /app/router"
    echo "Contents of /app:"
    ls -la /app/
    echo "Contents of /app/router:"
    ls -la /app/router/ 2>/dev/null || echo "/app/router does not exist"
    exit 1
fi
EOF

# Make the startup script executable
RUN chmod +x /app/start.sh

# Use the smart startup script
CMD ["/app/start.sh"]
