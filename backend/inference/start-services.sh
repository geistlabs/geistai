#!/bin/bash

# Startup script for inference server (HTTP only)
# This script starts both nginx and llama.cpp server

set -e

echo "🚀 Starting Geist Inference Server"
echo "=================================="
echo "📡 Mode: HTTP only"

# Start llama.cpp server in the background
echo ""
echo "🧠 Starting llama.cpp server on port 8080..."
/app/llama-server \
    --model /models/gpt-oss-20b-Q4_K_S.gguf \
    --host 127.0.0.1 \
    --port 8080 \
    --ctx-size 4096 \
    --threads 4 \
    --batch-size 512 \
    --ubatch-size 512 \
    --parallel 1 \
    --cont-batching \
    --mlock \
    --n-gpu-layers -1 &

LLAMA_PID=$!

# Wait a moment for llama.cpp to start
sleep 3

# Check if llama.cpp started successfully
if ! kill -0 $LLAMA_PID 2>/dev/null; then
    echo "❌ Failed to start llama.cpp server"
    exit 1
fi

echo "✅ llama.cpp server started (PID: $LLAMA_PID)"

# Start nginx
echo ""
echo "🌐 Starting nginx reverse proxy..."
echo "   - HTTP port: 80"

# Start nginx in foreground (this keeps the container running)
exec nginx -g "daemon off;"
