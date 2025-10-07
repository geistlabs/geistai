# Multi-stage build for optimized embeddings service
FROM python:3.11-slim AS builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies in a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies with optimizations
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download default model to avoid runtime download delays
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2', cache_folder='/opt/venv/models')"

# Production stage
FROM python:3.11-slim AS production

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set sentence-transformers cache directory
ENV SENTENCE_TRANSFORMERS_HOME="/opt/venv/models"

# Set working directory
WORKDIR /app

# Create models directory for caching
RUN mkdir -p /app/models

# Create non-root user
RUN useradd -m -u 1000 embeddings && \
    chown -R embeddings:embeddings /app

# Copy application files
COPY --chown=embeddings:embeddings main.py .
COPY --chown=embeddings:embeddings config.py .

# Switch to non-root user
USER embeddings

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]

# Example usage:
# docker run -d \
#   --name embeddings-server \
#   -p 8001:8001 \
#   alo42/embeddings:latest
