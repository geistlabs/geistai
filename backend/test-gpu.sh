#!/bin/bash

# GPU Test Script for GeistAI Inference Service
# This script tests GPU functionality and provides diagnostics

echo "🧪 Testing GPU Support for GeistAI Inference"
echo "============================================="

# Test 1: Check NVIDIA driver
echo "1️⃣  Checking NVIDIA driver..."
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA driver found"
    nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits
else
    echo "❌ NVIDIA driver not found"
    exit 1
fi

echo ""

# Test 2: Check Docker GPU access
echo "2️⃣  Testing Docker GPU access..."
if docker run --rm --gpus all nvidia/cuda:11.8-base nvidia-smi &> /dev/null; then
    echo "✅ Docker can access GPU"
else
    echo "❌ Docker cannot access GPU"
    echo "   Make sure NVIDIA Container Toolkit is installed:"
    echo "   sudo bash install-nvidia-docker.sh"
    exit 1
fi

echo ""

# Test 3: Check inference service GPU configuration
echo "3️⃣  Checking inference service configuration..."
if [ -f "docker-compose.yml" ]; then
    if grep -q "nvidia" docker-compose.yml; then
        echo "✅ Docker Compose configured for GPU"
    else
        echo "❌ Docker Compose not configured for GPU"
        exit 1
    fi
else
    echo "❌ docker-compose.yml not found"
    exit 1
fi

echo ""

# Test 4: Start inference service and check GPU usage
echo "4️⃣  Starting inference service with GPU..."
echo "   This may take a few minutes to load the model..."

# Stop any existing inference service
docker compose stop inference 2>/dev/null || true

# Start inference service
docker compose up inference -d

# Wait for service to start
echo "   Waiting for service to start..."
sleep 30

# Check if service is running
if docker compose ps inference | grep -q "Up"; then
    echo "✅ Inference service started successfully"
    
    # Check GPU usage
    echo "   Checking GPU usage..."
    nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits
    
    echo ""
    echo "🎉 GPU inference is working!"
    echo "   Your RTX 5070 is now being used for language model inference"
    echo "   This will significantly improve response times and throughput"
    
else
    echo "❌ Inference service failed to start"
    echo "   Check logs with: docker compose logs inference"
    exit 1
fi

echo ""
echo "🚀 Next steps:"
echo "   1. Test the chat interface at http://localhost:3000"
echo "   2. Monitor GPU usage with: watch nvidia-smi"
echo "   3. Check service logs with: docker compose logs inference"
