# Standalone Whisper STT Service
FROM python:3.11-slim

# Install system dependencies for whisper.cpp compilation
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install whisper.cpp with CUDA support (if available)
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp \
    && cd /tmp/whisper.cpp \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_CUDA=ON \
    && cmake --build build --config Release -j$(nproc) \
    && cp build/bin/whisper-cli /usr/local/bin/ \
    && find build -name "*.so*" -exec cp {} /usr/local/lib/ \; \
    && ldconfig \
    && rm -rf /tmp/whisper.cpp

# Create models directory for volume mount
RUN mkdir -p /models && chown 1000:1000 /models

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN pip install fastapi uvicorn python-multipart

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 whisper && chown -R whisper:whisper /app
USER whisper

# Expose port
EXPOSE 8004

# Use entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
