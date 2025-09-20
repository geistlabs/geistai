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

# Configuration
BACKEND_DIR="/Users/alexmartinez/openq-ws/geistai/backend"
INFERENCE_DIR="$BACKEND_DIR/inference/llama.cpp"
ROUTER_DIR="$BACKEND_DIR/router"
MODEL_PATH="$BACKEND_DIR/inference/models/gpt-oss-20b-Q4_K_S.gguf"

# Ports
INFERENCE_PORT=8080
ROUTER_PORT=8000

# GPU settings for Apple Silicon
GPU_LAYERS=32  # All layers on GPU for best performance
CONTEXT_SIZE=4096
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
    echo -e "${RED}❌ llama.cpp directory not found: $INFERENCE_DIR${NC}"
    exit 1
fi

if [[ ! -f "$INFERENCE_DIR/build/bin/llama-server" ]]; then
    echo -e "${RED}❌ llama-server not found. Run 'make' in llama.cpp directory first${NC}"
    exit 1
fi

if [[ ! -f "$MODEL_PATH" ]]; then
    echo -e "${RED}❌ Model file not found: $MODEL_PATH${NC}"
    exit 1
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

# Start router service
echo -e "${BLUE}⚡ Starting router service (FastAPI)...${NC}"
echo -e "${YELLOW}   Harmony: Enabled${NC}"
echo -e "${YELLOW}   Reasoning: Low (fast responses)${NC}"
echo -e "${YELLOW}   Port: $ROUTER_PORT${NC}"

cd "$ROUTER_DIR"

# Set environment variables for local development
export ENVIRONMENT=development
export LOG_LEVEL=INFO
export HARMONY_ENABLED=true
export HARMONY_REASONING_EFFORT=low
export INFERENCE_URL=http://localhost:$INFERENCE_PORT
export INFERENCE_TIMEOUT=60
export API_HOST=0.0.0.0
export API_PORT=$ROUTER_PORT

uv run python main.py > /tmp/geist-router.log 2>&1 &
ROUTER_PID=$!
echo -e "${GREEN}✅ Router service starting (PID: $ROUTER_PID)${NC}"

# Wait for router to be ready
echo -e "${BLUE}⏳ Waiting for router service...${NC}"
sleep 3

max_attempts=15
attempt=0
while [[ $attempt -lt $max_attempts ]]; do
    if curl -s http://localhost:$ROUTER_PORT/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Router service is ready!${NC}"
        break
    fi

    if ! kill -0 $ROUTER_PID 2>/dev/null; then
        echo -e "${RED}❌ Router service failed to start. Check logs: tail -f /tmp/geist-router.log${NC}"
        exit 1
    fi

    echo -e "${YELLOW}   ... starting router (attempt $((attempt+1))/$max_attempts)${NC}"
    sleep 1
    ((attempt++))
done

if [[ $attempt -eq $max_attempts ]]; then
    echo -e "${RED}❌ Router service failed to respond after $max_attempts attempts${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/geist-router.log${NC}"
    exit 1
fi

# Display status
echo ""
echo -e "${GREEN}🎉 Geist Backend Local Development Environment Ready!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "   🧠 Inference Server: ${GREEN}http://localhost:$INFERENCE_PORT${NC} (GPT-OSS 20B + Metal GPU)"
echo -e "   ⚡ Router Service:    ${GREEN}http://localhost:$ROUTER_PORT${NC} (FastAPI + Harmony)"
echo ""
echo -e "${BLUE}🔗 API Endpoints:${NC}"
echo -e "   Health Check:     ${YELLOW}GET  http://localhost:$ROUTER_PORT/health${NC}"
echo -e "   Chat (blocking):  ${YELLOW}POST http://localhost:$ROUTER_PORT/api/chat${NC}"
echo -e "   Chat (streaming): ${YELLOW}POST http://localhost:$ROUTER_PORT/api/chat/stream${NC} ${GREEN}(recommended)${NC}"
echo ""
echo -e "${BLUE}🧪 Quick Test Commands:${NC}"
echo -e "   Health: ${YELLOW}curl http://localhost:$ROUTER_PORT/health${NC}"
echo -e "   Chat:   ${YELLOW}curl -X POST http://localhost:$ROUTER_PORT/api/chat -H 'Content-Type: application/json' -d '{\"message\":\"Hello!\"}'${NC}"
echo ""
echo -e "${BLUE}📝 Log Files:${NC}"
echo -e "   Inference: ${YELLOW}tail -f /tmp/geist-inference.log${NC}"
echo -e "   Router:    ${YELLOW}tail -f /tmp/geist-router.log${NC}"
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
    # Check if services are still running
    if ! kill -0 $INFERENCE_PID 2>/dev/null; then
        echo -e "${RED}❌ Inference server died unexpectedly${NC}"
        exit 1
    fi

    if ! kill -0 $ROUTER_PID 2>/dev/null; then
        echo -e "${RED}❌ Router service died unexpectedly${NC}"
        exit 1
    fi

    sleep 10
done
