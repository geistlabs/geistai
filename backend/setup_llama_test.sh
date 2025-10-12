#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Llama 3.1 8B Test Setup${NC}"
echo "====================================="
echo ""

BACKEND_DIR="/Users/alexmartinez/openq-ws/geistai/backend"
MODEL_DIR="$BACKEND_DIR/inference/models"
LLAMA_MODEL="$MODEL_DIR/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
WHISPER_CPP="$BACKEND_DIR/whisper.cpp"

# Step 1: Check if model exists
echo -e "${BLUE}Step 1: Checking for Llama 3.1 8B model...${NC}"
if [ -f "$LLAMA_MODEL" ]; then
    echo -e "${GREEN}✅ Model already downloaded: $LLAMA_MODEL${NC}"
    ls -lh "$LLAMA_MODEL"
else
    echo -e "${YELLOW}⚠️  Model not found. Downloading...${NC}"
    echo ""
    echo "This will download ~5GB. Continue? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        mkdir -p "$MODEL_DIR"
        cd "$MODEL_DIR" || exit

        echo -e "${BLUE}Downloading Llama 3.1 8B Instruct Q4_K_M...${NC}"
        wget -O "$LLAMA_MODEL" \
            "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Download complete!${NC}"
            ls -lh "$LLAMA_MODEL"
        else
            echo -e "${RED}❌ Download failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Cancelled. Please download the model manually.${NC}"
        exit 0
    fi
fi

echo ""

# Step 2: Check if port 8083 is available
echo -e "${BLUE}Step 2: Checking port 8083...${NC}"
if lsof -i :8083 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8083 is in use. Killing existing process...${NC}"
    kill -9 $(lsof -ti :8083) 2>/dev/null
    sleep 2
fi
echo -e "${GREEN}✅ Port 8083 is available${NC}"

echo ""

# Step 3: Check if port 8082 (GPT-OSS) is running
echo -e "${BLUE}Step 3: Checking if GPT-OSS is running on port 8082...${NC}"
if lsof -i :8082 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ GPT-OSS is running on port 8082${NC}"
else
    echo -e "${YELLOW}⚠️  GPT-OSS not running. You need to start it first:${NC}"
    echo -e "${YELLOW}   cd $BACKEND_DIR && ./start-local-dev.sh${NC}"
    echo ""
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        exit 0
    fi
fi

echo ""

# Step 4: Start Llama on port 8083
echo -e "${BLUE}Step 4: Starting Llama 3.1 8B on port 8083...${NC}"

cd "$WHISPER_CPP" || exit

./build/bin/llama-server \
    -m "$LLAMA_MODEL" \
    --host 0.0.0.0 \
    --port 8083 \
    --ctx-size 8192 \
    --n-gpu-layers 32 \
    --threads 0 \
    --cont-batching \
    --parallel 2 \
    --batch-size 256 \
    --ubatch-size 128 \
    --mlock \
    > /tmp/geist-llama-test.log 2>&1 &

LLAMA_PID=$!
echo -e "${GREEN}✅ Llama started (PID: $LLAMA_PID)${NC}"

echo ""
echo -e "${BLUE}Waiting for Llama to initialize...${NC}"
sleep 5

# Step 5: Health check
echo -e "${BLUE}Step 5: Running health checks...${NC}"

# Check Llama
if curl -s http://localhost:8083/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Llama 3.1 8B: http://localhost:8083 - Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Llama health check failed, but process is running${NC}"
    echo -e "${YELLOW}   Check logs: tail -f /tmp/geist-llama-test.log${NC}"
fi

# Check GPT-OSS
if curl -s http://localhost:8082/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ GPT-OSS 20B: http://localhost:8082 - Healthy${NC}"
else
    echo -e "${RED}❌ GPT-OSS not responding. Start it first!${NC}"
fi

echo ""

# Step 6: Quick validation test
echo -e "${BLUE}Step 6: Running quick validation test...${NC}"
echo ""

TEST_RESPONSE=$(curl -s http://localhost:8083/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "Say hello"}], "stream": false, "max_tokens": 20}' | \
    jq -r '.choices[0].message.content' 2>/dev/null)

if [ -n "$TEST_RESPONSE" ]; then
    echo -e "${GREEN}✅ Llama is responding:${NC}"
    echo "   Response: $TEST_RESPONSE"

    # Check for artifacts
    if echo "$TEST_RESPONSE" | grep -q "<|channel|>"; then
        echo -e "${RED}   ❌ Found Harmony artifacts in response!${NC}"
    elif echo "$TEST_RESPONSE" | grep -qi "we need to"; then
        echo -e "${YELLOW}   ⚠️  Found meta-commentary in response${NC}"
    else
        echo -e "${GREEN}   ✅ Clean response (no artifacts detected)${NC}"
    fi
else
    echo -e "${RED}❌ No response from Llama${NC}"
    echo -e "${YELLOW}   Check logs: tail -f /tmp/geist-llama-test.log${NC}"
fi

echo ""
echo "====================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "====================================="
echo ""
echo -e "${BLUE}📍 Services status:${NC}"
echo "   GPT-OSS 20B:    http://localhost:8082"
echo "   Llama 3.1 8B:   http://localhost:8083 (test)"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "   1. Run comparison test:"
echo "      cd backend/router"
echo "      uv run python compare_models.py"
echo ""
echo "   2. Monitor Llama logs:"
echo "      tail -f /tmp/geist-llama-test.log"
echo ""
echo "   3. To stop Llama test instance:"
echo "      kill $LLAMA_PID"
echo ""
echo -e "${BLUE}💡 Tip: The comparison will test 9 queries on each model${NC}"
echo "   This will take ~5-10 minutes"
echo ""
