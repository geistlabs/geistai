# Start with Python 3.11 as our base
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install whisper.cpp binary (like llama.cpp server pattern)
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp \
    && cd /tmp/whisper.cpp \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j$(nproc) \
    && cp build/bin/whisper-cli /usr/local/bin/ \
    && find build -name "*.so*" -exec cp {} /usr/local/lib/ \; \
    && ldconfig \
    && rm -rf /tmp/whisper.cpp

# Create models directory for volume mount (like llama.cpp pattern)
RUN mkdir -p /models && chown 1000:1000 /models

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
