# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the entire backend directory
COPY . .

# Install dependencies from pyproject.toml
RUN pip install -e .

# Install additional MCP dependencies
RUN pip install "mcp[docker]" websockets

# Set environment variables for cross-service package access
ENV PYTHONPATH=/app:/app/router:/app/embeddings:/app/database
# Install dependencies
RUN pip install fastapi uvicorn httpx openai-harmony sse-starlette python-multipart

# Create non-root user
RUN useradd -m -u 1000 router && chown -R router:router /app
USER router

# Set working directory to router
WORKDIR /app/router

# Expose ports (8000 for HTTP, 8443 for HTTPS)
EXPOSE 8000 8443

# Start command
CMD ["python", "main.py"]
