#!/bin/bash

# GeistAI Docker Compose Startup Script
# Automatically detects GPU availability and starts appropriate services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 GeistAI Startup Script${NC}"
echo "=================================="

# Function to check if NVIDIA GPU is available
check_nvidia_gpu() {
    echo -e "${YELLOW}🔍 Checking for NVIDIA GPU support...${NC}"
    
    # Check if nvidia-smi is available and working
    if command -v nvidia-smi >/dev/null 2>&1; then
        if nvidia-smi >/dev/null 2>&1; then
            echo -e "${GREEN}✅ NVIDIA GPU detected${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  nvidia-smi found but not working${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  nvidia-smi not found${NC}"
        return 1
    fi
}

# Function to check if Docker supports NVIDIA runtime
check_docker_nvidia() {
    echo -e "${YELLOW}🐳 Checking Docker NVIDIA runtime...${NC}"
    
    # Test if Docker can access NVIDIA GPU
    if docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker NVIDIA runtime working${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Docker NVIDIA runtime not available${NC}"
        return 1
    fi
}

# Function to start services with GPU
start_with_gpu() {
    echo -e "${GREEN}🎮 Starting services with GPU acceleration...${NC}"
    docker compose --profile gpu up "$@"
}

# Function to start services without GPU
start_without_gpu() {
    echo -e "${BLUE}💻 Starting services in CPU-only mode...${NC}"
    docker compose --profile cpu up "$@"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --gpu         Force GPU mode (skip detection)"
    echo "  --cpu         Force CPU mode (skip detection)"
    echo "  --detach, -d  Run in detached mode"
    echo "  --build       Rebuild images before starting"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Auto-detect GPU and start"
    echo "  $0 --gpu -d          # Force GPU mode, detached"
    echo "  $0 --cpu --build     # Force CPU mode, rebuild images"
}

# Parse command line arguments
FORCE_MODE=""
DOCKER_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --gpu)
            FORCE_MODE="gpu"
            shift
            ;;
        --cpu)
            FORCE_MODE="cpu"
            shift
            ;;
        --detach|-d)
            DOCKER_ARGS="$DOCKER_ARGS -d"
            shift
            ;;
        --build)
            DOCKER_ARGS="$DOCKER_ARGS --build"
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Main logic
if [[ "$FORCE_MODE" == "gpu" ]]; then
    echo -e "${YELLOW}🔧 Forced GPU mode${NC}"
    start_with_gpu $DOCKER_ARGS
elif [[ "$FORCE_MODE" == "cpu" ]]; then
    echo -e "${YELLOW}🔧 Forced CPU mode${NC}"
    start_without_gpu $DOCKER_ARGS
else
    # Auto-detect GPU availability
    if check_nvidia_gpu && check_docker_nvidia; then
        echo -e "${GREEN}🎯 Auto-detected: GPU mode available${NC}"
        start_with_gpu $DOCKER_ARGS
    else
        echo -e "${BLUE}🎯 Auto-detected: Using CPU mode${NC}"
        start_without_gpu $DOCKER_ARGS
    fi
fi
