#!/bin/bash

# Geist Backend Local Development Startup Script
# Optimized for Apple Silicon MacBook with GPU acceleration
# Usage: ./start-local-dev.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Dynamically determine script location
# This makes the script portable across different machines and users
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
INFERENCE_DIR="$BACKEND_DIR/inference/llama.cpp"
ROUTER_DIR="$BACKEND_DIR/router"
MODEL_PATH="$BACKEND_DIR/inference/models/openai_gpt-oss-20b-Q4_K_S.gguf"

# Ports
INFERENCE_PORT=8080
ROUTER_PORT=8000
WHISPER_PORT=8004

# GPU settings for Apple Silicon
GPU_LAYERS=32  # All layers on GPU for best performance
CONTEXT_SIZE=16384  # 4096 per slot with --parallel 4 (required for tool calling)
THREADS=0  # Auto-detect CPU threads

echo -e "${BLUE}🚀 Starting Geist Backend Local Development Environment${NC}"
echo -e "${BLUE}📱 Optimized for Apple Silicon MacBook with Metal GPU${NC}"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port)
    if [[ -n "$pids" ]]; then
        echo -e "${YELLOW}⚠️  Killing existing processes on port $port${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to cleanup on script exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill_port $INFERENCE_PORT
    kill_port $ROUTER_PORT
    kill_port $WHISPER_PORT
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM EXIT

# Validate paths and files
echo -e "${BLUE}🔍 Validating environment...${NC}"

if [[ ! -d "$BACKEND_DIR" ]]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

if [[ ! -d "$INFERENCE_DIR" ]]; then
    echo -e "${YELLOW}⚠️  llama.cpp not found. Setting up now...${NC}"
    cd "$BACKEND_DIR/inference"
    git clone https://github.com/ggerganov/llama.cpp.git
    cd llama.cpp
    echo -e "${BLUE}🔨 Building llama.cpp with Metal support using CMake...${NC}"
    cmake -B build -DLLAMA_METAL=ON
    cmake --build build --config Release -- -j8
    echo -e "${GREEN}✅ llama.cpp setup complete${NC}"
fi

if [[ ! -f "$INFERENCE_DIR/build/bin/llama-server" ]]; then
    echo -e "${YELLOW}⚠️  llama-server not found. Building now...${NC}"
    cd "$INFERENCE_DIR"
    rm -rf build
    cmake -B build -DLLAMA_METAL=ON
    cmake --build build --config Release -- -j8
    echo -e "${GREEN}✅ llama-server built successfully${NC}"
fi

# Setup whisper.cpp for speech-to-text (provides whisper-cli and model for local Whisper STT service)
WHISPER_DIR="$BACKEND_DIR/whisper.cpp"
WHISPER_BINARY_PATH="$WHISPER_DIR/build/bin/whisper-cli"
WHISPER_MODEL_PATH="$WHISPER_DIR/models/ggml-base.bin"

if [[ ! -d "$WHISPER_DIR" ]] || [[ ! -f "$WHISPER_DIR/CMakeLists.txt" ]]; then
    echo -e "${YELLOW}⚠️  whisper.cpp not found or incomplete. Setting up now...${NC}"
    cd "$BACKEND_DIR"
    # Remove incomplete directory if it exists
    rm -rf whisper.cpp
    git clone https://github.com/ggerganov/whisper.cpp.git
    cd whisper.cpp
    echo -e "${BLUE}🔨 Building whisper.cpp with Metal support using CMake...${NC}"
    rm -rf build
    cmake -B build -DGGML_METAL=ON
    cmake --build build --config Release -- -j4
    echo -e "${GREEN}✅ whisper.cpp setup complete${NC}"
fi

if [[ ! -f "$WHISPER_BINARY_PATH" ]]; then
    echo -e "${YELLOW}⚠️  whisper-cli not found. Building now...${NC}"
    cd "$WHISPER_DIR"
    rm -rf build
    cmake -B build -DGGML_METAL=ON
    cmake --build build --config Release -- -j4
    echo -e "${GREEN}✅ whisper-cli built successfully${NC}"
fi

if [[ ! -f "$WHISPER_MODEL_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Whisper model not found: $WHISPER_MODEL_PATH${NC}"
    echo -e "${BLUE}📥 Downloading Whisper base model...${NC}"
    echo -e "${YELLOW}   This is a ~140MB download${NC}"

    # Create models directory if it doesn't exist
    mkdir -p "$(dirname "$WHISPER_MODEL_PATH")"

    # Download the whisper model using the official script
    echo -e "${BLUE}   Downloading using whisper.cpp download script...${NC}"
    cd "$WHISPER_DIR"
    ./models/download-ggml-model.sh base || {
        echo -e "${RED}❌ Failed to download Whisper model${NC}"
        echo -e "${YELLOW}   Please manually download the model and place it at:${NC}"
        echo -e "${YELLOW}   $WHISPER_MODEL_PATH${NC}"
        echo -e "${YELLOW}   Or run: cd $WHISPER_DIR && ./models/download-ggml-model.sh base${NC}"
        exit 1
    }

    # Verify the download
    if [[ -f "$WHISPER_MODEL_PATH" && -s "$WHISPER_MODEL_PATH" ]]; then
        echo -e "${GREEN}✅ Whisper model downloaded successfully${NC}"
    else
        echo -e "${RED}❌ Whisper model download failed or file is empty${NC}"
        echo -e "${YELLOW}   Please manually download the model and place it at:${NC}"
        echo -e "${YELLOW}   $WHISPER_MODEL_PATH${NC}"
        exit 1
    fi
fi

if [[ ! -f "$MODEL_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Model file not found: $MODEL_PATH${NC}"
    echo -e "${BLUE}📥 Downloading GPT-OSS 20B model (Q4_K_S)...${NC}"
    echo -e "${YELLOW}   This is a ~12GB download and may take several minutes${NC}"

    # Create model directory if it doesn't exist
    mkdir -p "$(dirname "$MODEL_PATH")"

    # Download the model using curl with progress bar
    echo -e "${BLUE}   Downloading from Hugging Face...${NC}"
    curl -L --progress-bar \
        "https://huggingface.co/unsloth/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-Q4_K_S.gguf" \
        -o "$MODEL_PATH" 2>/dev/null || {
        echo -e "${RED}❌ Failed to download model from Hugging Face${NC}"
        echo -e "${YELLOW}   Please manually download a GGUF model and place it at:${NC}"
        echo -e "${YELLOW}   $MODEL_PATH${NC}"
        echo -e "${YELLOW}   Or update MODEL_PATH in this script to point to your model${NC}"
        echo -e "${YELLOW}   Recommended models:${NC}"
        echo -e "${YELLOW}   • GPT-OSS 20B: https://huggingface.co/unsloth/gpt-oss-20b-GGUF${NC}"
        echo -e "${YELLOW}   • Llama-2-7B-Chat: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF${NC}"
        exit 1
    }

    # Verify the download
    if [[ -f "$MODEL_PATH" && -s "$MODEL_PATH" ]]; then
        echo -e "${GREEN}✅ Model downloaded successfully${NC}"
    else
        echo -e "${RED}❌ Model download failed or file is empty${NC}"
        echo -e "${YELLOW}   Please manually download a GGUF model and place it at:${NC}"
        echo -e "${YELLOW}   $MODEL_PATH${NC}"
        exit 1
    fi
fi

if [[ ! -d "$ROUTER_DIR" ]]; then
    echo -e "${RED}❌ Router directory not found: $ROUTER_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment validation complete${NC}"

# Stop Docker services if running
echo -e "${BLUE}🐳 Stopping Docker services (if running)...${NC}"
cd "$BACKEND_DIR"
docker-compose down 2>/dev/null || true

# Kill any processes on our ports
kill_port $INFERENCE_PORT
kill_port $ROUTER_PORT

# Start inference server
echo -e "${BLUE}🧠 Starting inference server (llama.cpp)...${NC}"
echo -e "${YELLOW}   Model: GPT-OSS 20B (Q4_K_S)${NC}"
echo -e "${YELLOW}   GPU Layers: $GPU_LAYERS (Metal acceleration)${NC}"
echo -e "${YELLOW}   Context: $CONTEXT_SIZE tokens${NC}"
echo -e "${YELLOW}   Port: $INFERENCE_PORT${NC}"

cd "$INFERENCE_DIR"
./build/bin/llama-server \
    -m "$MODEL_PATH" \
    --host 0.0.0.0 \
    --port $INFERENCE_PORT \
    --ctx-size $CONTEXT_SIZE \
    --n-gpu-layers $GPU_LAYERS \
    --threads $THREADS \
    --cont-batching \
    --parallel 4 \
    --batch-size 512 \
    --ubatch-size 256 \
    --mlock \
    --jinja \
    > /tmp/geist-inference.log 2>&1 &

INFERENCE_PID=$!
echo -e "${GREEN}✅ Inference server starting (PID: $INFERENCE_PID)${NC}"

# Wait for inference server to be ready
echo -e "${BLUE}⏳ Waiting for inference server to load model...${NC}"
sleep 5

# Check if inference server is responding
max_attempts=30
attempt=0
while [[ $attempt -lt $max_attempts ]]; do
    if curl -s http://localhost:$INFERENCE_PORT/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Inference server is ready!${NC}"
        break
    fi

    if ! kill -0 $INFERENCE_PID 2>/dev/null; then
        echo -e "${RED}❌ Inference server failed to start. Check logs: tail -f /tmp/geist-inference.log${NC}"
        exit 1
    fi

    echo -e "${YELLOW}   ... still loading model (attempt $((attempt+1))/$max_attempts)${NC}"
    sleep 2
    ((attempt++))
done

if [[ $attempt -eq $max_attempts ]]; then
    echo -e "${RED}❌ Inference server failed to respond after $max_attempts attempts${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/geist-inference.log${NC}"
    exit 1
fi

# Start Whisper STT service
echo -e "${BLUE}🗣️  Starting Whisper STT service (FastAPI)...${NC}"
echo -e "${YELLOW}   Port: $WHISPER_PORT${NC}"

cd "$BACKEND_DIR/whisper-stt"

# Environment for Whisper STT
export WHISPER_BINARY_PATH="$WHISPER_BINARY_PATH"
export WHISPER_MODEL_PATH="$WHISPER_MODEL_PATH"
export PORT=$WHISPER_PORT

# Start Whisper using uv with inline deps if available; else use a local venv
if command -v uv >/dev/null 2>&1; then
    echo -e "${BLUE}📦 Starting Whisper STT with uv and inline deps...${NC}"
    uv run --with fastapi --with uvicorn --with python-multipart \
        python main.py > /tmp/geist-whisper.log 2>&1 &
    WHISPER_PID=$!
else
    echo -e "${YELLOW}⚠️  uv not found, creating local venv for Whisper STT...${NC}"
    VENV_DIR="$BACKEND_DIR/.venv"
    if [[ ! -d "$VENV_DIR" ]]; then
        python3 -m venv "$VENV_DIR"
    fi
    # shellcheck disable=SC1090
    source "$VENV_DIR/bin/activate"
    python -m pip install -q fastapi uvicorn python-multipart
    python main.py > /tmp/geist-whisper.log 2>&1 &
    WHISPER_PID=$!
fi
echo -e "${GREEN}✅ Whisper STT service starting (PID: $WHISPER_PID)${NC}"

# Wait for Whisper STT to be ready
echo -e "${BLUE}⏳ Waiting for Whisper STT service...${NC}"
sleep 2

max_attempts=30
attempt=0
while [[ $attempt -lt $max_attempts ]]; do
    if curl -s http://localhost:$WHISPER_PORT/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Whisper STT service is ready!${NC}"
        break
    fi

    if ! kill -0 $WHISPER_PID 2>/dev/null; then
        echo -e "${RED}❌ Whisper STT service failed to start. Check logs: tail -f /tmp/geist-whisper.log${NC}"
        exit 1
    fi

    echo -e "${YELLOW}   ... starting whisper (attempt $((attempt+1))/$max_attempts)${NC}"
    sleep 1
    ((attempt++))
done

if [[ $attempt -eq $max_attempts ]]; then
    echo -e "${RED}❌ Whisper STT service failed to respond after $max_attempts attempts${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/geist-whisper.log${NC}"
    exit 1
fi

# Router service is now started via Docker (docker-compose --profile local)
# This script only starts GPU services (inference + whisper)
echo -e "${BLUE}⚡ Router service should be started separately via Docker:${NC}"
echo -e "${YELLOW}   cd backend && docker-compose --profile local up -d${NC}"

# Display status
echo ""
echo -e "${GREEN}🎉 Native GPU Services Ready!${NC}"
echo ""
echo -e "${BLUE}📊 GPU Service Status:${NC}"
echo -e "   🧠 Inference Server: ${GREEN}http://localhost:$INFERENCE_PORT${NC} (GPT-OSS 20B + Metal GPU)"
echo -e "   🗣️  Whisper STT:       ${GREEN}http://localhost:$WHISPER_PORT${NC} (FastAPI + whisper.cpp)"
echo ""
echo -e "${BLUE}🐳 Next Step - Start Docker Services:${NC}"
echo -e "   ${YELLOW}cd backend && docker-compose --profile local up -d${NC}"
echo -e "   This will start: Router, Embeddings, MCP Brave, MCP Fetch"
echo ""
echo -e "${BLUE}🧪 Test GPU Services:${NC}"
echo -e "   Inference: ${YELLOW}curl http://localhost:$INFERENCE_PORT/health${NC}"
echo -e "   Whisper:   ${YELLOW}curl http://localhost:$WHISPER_PORT/health${NC}"
echo ""
echo -e "${BLUE}📝 Log Files:${NC}"
echo -e "   Inference: ${YELLOW}tail -f /tmp/geist-inference.log${NC}"
echo -e "   Whisper:   ${YELLOW}tail -f /tmp/geist-whisper.log${NC}"
echo -e "   Router:    ${YELLOW}tail -f /tmp/geist-router.log${NC}"
echo ""
echo -e "${BLUE}🎤 STT Service:${NC}"
echo -e "   Binary:    ${YELLOW}$WHISPER_BINARY_PATH${NC}"
echo -e "   Model:     ${YELLOW}$WHISPER_MODEL_PATH${NC}"
echo -e "   URL:       ${YELLOW}http://localhost:$WHISPER_PORT${NC}"
echo ""
echo -e "${BLUE}💡 Performance Notes:${NC}"
echo -e "   • ${GREEN}~15x faster${NC} than Docker (1-2 seconds vs 20+ seconds)"
echo -e "   • Full Apple M3 Pro GPU acceleration with Metal"
echo -e "   • All $GPU_LAYERS model layers running on GPU"
echo -e "   • Streaming responses for real-time feel"
echo ""
echo -e "${GREEN}✨ Ready for development! Press Ctrl+C to stop all services.${NC}"
echo ""

# Keep script running and show live status
while true; do
    # Check if GPU services are still running
    if ! kill -0 $INFERENCE_PID 2>/dev/null; then
        echo -e "${RED}❌ Inference server died unexpectedly${NC}"
        exit 1
    fi

    if ! kill -0 $WHISPER_PID 2>/dev/null; then
        echo -e "${RED}❌ Whisper STT service died unexpectedly${NC}"
        exit 1
    fi

    sleep 10
done
