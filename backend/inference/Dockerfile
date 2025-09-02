
  # Use pre-built llama.cpp server image for ARM64/Apple Silicon
  FROM --platform=linux/arm64 ghcr.io/ggml-org/llama.cpp:server

  # Install necessary tools
  USER root
  RUN apt-get update && apt-get install -y \
      wget \
      curl \
      && rm -rf /var/lib/apt/lists/*

  # Copy your local model
  COPY llama.cpp/models/gpt-oss-20b-Q4_K_S.gguf /models/

  # Switch back to non-root user for security (production best practice)
  USER 1000

  # Expose port 8080 for internal service communication
  EXPOSE 8080

  # Production environment variables
  ENV MODEL_PATH=/models/gpt-oss-20b-Q4_K_S.gguf
  ENV HOST=0.0.0.0
  ENV PORT=8080
  ENV CONTEXT_SIZE=4096
  ENV THREADS=0
  ENV GPU_LAYERS=0
  ENV LOG_LEVEL=INFO

  # Production health check
  HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
      CMD curl -f http://localhost:8080/health || exit 1

  # Production start command - use environment variables
  CMD ["/bin/sh", "-c", "/app/llama-server --model $MODEL_PATH --host $HOST --port $PORT --ctx-size $CONTEXT_SIZE --threads $THREADS --n-gpu-layers $GPU_LAYERS --log-disable"]