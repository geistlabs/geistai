# GeistAI - Final Implementation Plan

**Date**: October 12, 2025
**Owner**: Alex Martinez
**Status**: Ready to Execute
**Timeline**: 5-7 days to MVP

---

## Executive Summary

**Problem**: GPT-OSS 20B fails on 30% of queries (weather, news, search) due to infinite tool-calling loops and no content generation.

**Solution**: Two-model architecture with intelligent routing:

- **Qwen 2.5 32B Instruct** for tool-calling queries (weather, news, search) and complex reasoning
- **GPT-OSS 20B** for creative/simple queries (already works)

**Expected Results**:

- Tool query success: 0% → 90% ✅
- Weather/news latency: 60s+ timeout → 8-15s ✅
- Simple queries: Maintain 1-3s (no regression) ✅
- Average latency: 4-6 seconds
- Zero infinite loops, zero blank responses

---

## Architecture Overview

```
User Query
    ↓
Router (heuristic classification)
    ↓
    ├─→ Tool Required? (weather, news, search)
    │   ├─ Pass A: Plan & Execute Tools (Qwen 32B)
    │   │   └─ Bounded: max 1 search, 2 fetch, 15s timeout
    │   └─ Pass B: Answer Mode (Qwen 32B, tools DISABLED)
    │       └─ Firewall: Drop any tool_calls, force content
    │
    ├─→ Creative/Simple? (poems, jokes, math)
    │   └─ Direct: GPT-OSS 20B (1-3 seconds)
    │
    └─→ Complex? (code, multilingual)
        └─ Direct: Qwen 32B (no tools, 5-10 seconds)
```

---

## Phase 1: Foundation (Days 1-2)

### Day 1 Morning: Download Qwen

**Task**: Download Qwen 2.5 Coder 32B model

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/inference/models

# Download (18GB - takes 8-10 minutes)
wget https://huggingface.co/gandhar/Qwen2.5-32B-Instruct-Q4_K_M-GGUF/resolve/main/qwen2.5-32b-instruct-q4_k_m.gguf

# Verify download
ls -lh qwen2.5-32b-instruct-q4_k_m.gguf
# Should show ~19GB
```

**Duration**: 2-3 hours (download in background)

**Success Criteria**:

- ✅ File exists: `qwen2.5-32b-instruct-q4_k_m.gguf`
- ✅ Size: ~19GB
- ✅ MD5 checksum passes (optional)

---

### Day 1 Afternoon: Configure Multi-Model Setup

**Task**: Update `start-local-dev.sh` to run both models

**File**: `backend/start-local-dev.sh`

```bash
#!/bin/bash

echo "🚀 Starting GeistAI Multi-Model Backend"
echo "========================================"

# Configuration
INFERENCE_DIR="/Users/alexmartinez/openq-ws/geistai/backend/inference"
WHISPER_DIR="/Users/alexmartinez/openq-ws/geistai/backend/whisper.cpp"

# GPU settings for Apple M4 Pro
GPU_LAYERS_QWEN=33
GPU_LAYERS_GPT_OSS=32
CONTEXT_SIZE_QWEN=32768
CONTEXT_SIZE_GPT_OSS=8192

echo ""
echo "🧠 Starting Qwen 2.5 32B Instruct (tool queries) on port 8080..."
cd "$INFERENCE_DIR"
./llama.cpp/build/bin/llama-server \
    -m "./models/qwen2.5-32b-instruct-q4_k_m.gguf" \
    --host 0.0.0.0 \
    --port 8080 \
    --ctx-size $CONTEXT_SIZE_QWEN \
    --n-gpu-layers $GPU_LAYERS_QWEN \
    --threads 0 \
    --cont-batching \
    --parallel 4 \
    --batch-size 512 \
    --ubatch-size 256 \
    --mlock \
    --jinja \
    > /tmp/geist-qwen.log 2>&1 &

QWEN_PID=$!
echo "   Started (PID: $QWEN_PID)"

sleep 5

echo ""
echo "📝 Starting GPT-OSS 20B (creative/simple) on port 8082..."
./llama.cpp/build/bin/llama-server \
    -m "./models/openai_gpt-oss-20b-Q4_K_S.gguf" \
    --host 0.0.0.0 \
    --port 8082 \
    --ctx-size $CONTEXT_SIZE_GPT_OSS \
    --n-gpu-layers $GPU_LAYERS_GPT_OSS \
    --threads 0 \
    --cont-batching \
    --parallel 2 \
    --batch-size 256 \
    --ubatch-size 128 \
    --mlock \
    > /tmp/geist-gpt-oss.log 2>&1 &

GPT_OSS_PID=$!
echo "   Started (PID: $GPT_OSS_PID)"

sleep 5

echo ""
echo "🗣️  Starting Whisper STT on port 8004..."
cd "$WHISPER_DIR"
uv run --with "fastapi uvicorn python-multipart" \
    python -c "
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn
import subprocess
import tempfile
import os

app = FastAPI()

WHISPER_MODEL = '/Users/alexmartinez/openq-ws/geistai/test-models/ggml-base.bin'
WHISPER_BIN = '/Users/alexmartinez/openq-ws/geistai/backend/whisper.cpp/build/bin/whisper-cli'

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/transcribe')
async def transcribe(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [WHISPER_BIN, '-m', WHISPER_MODEL, '-f', tmp_path, '-nt'],
            capture_output=True, text=True, timeout=30
        )
        return JSONResponse({'text': result.stdout.strip()})
    finally:
        os.unlink(tmp_path)

uvicorn.run(app, host='0.0.0.0', port=8004)
" > /tmp/geist-whisper.log 2>&1 &

WHISPER_PID=$!
echo "   Started (PID: $WHISPER_PID)"

sleep 3

# Health checks
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Health Checks:"
curl -s http://localhost:8080/health && echo "   Qwen 32B: http://localhost:8080 ✅" || echo "   Qwen 32B: ❌"
curl -s http://localhost:8082/health && echo "   GPT-OSS 20B: http://localhost:8082 ✅" || echo "   GPT-OSS 20B: ❌"
curl -s http://localhost:8004/health && echo "   Whisper STT: http://localhost:8004 ✅" || echo "   Whisper STT: ❌"

echo ""
echo "🎉 Multi-Model Backend Ready!"
echo ""
echo "📊 Model Assignment:"
echo "   Port 8080: Qwen 32B (weather, news, search, code)"
echo "   Port 8082: GPT-OSS 20B (creative, simple, conversation)"
echo "   Port 8004: Whisper STT (audio transcription)"
echo ""
echo "📝 Log Files:"
echo "   Qwen:     tail -f /tmp/geist-qwen.log"
echo "   GPT-OSS:  tail -f /tmp/geist-gpt-oss.log"
echo "   Whisper:  tail -f /tmp/geist-whisper.log"
echo ""
echo "💡 Memory Usage: ~30GB (Qwen 18GB + GPT-OSS 12GB)"
echo ""
echo "Press Ctrl+C to stop all services..."

# Keep script running
wait
```

**Test**:

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend
./start-local-dev.sh

# In another terminal:
curl http://localhost:8080/health  # Qwen
curl http://localhost:8082/health  # GPT-OSS
curl http://localhost:8004/health  # Whisper
```

**Success Criteria**:

- ✅ All 3 health checks return `{"status":"ok"}`
- ✅ Models load without errors
- ✅ Memory usage ~30GB

---

### Day 1 Evening: Test Basic Qwen Functionality

**Task**: Verify Qwen works for simple queries

```bash
# Test 1: Simple query (no tools)
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "stream": false,
    "max_tokens": 100
  }'

# Expected: Should return "4" quickly

# Test 2: Creative query
curl -X POST http://localhost:8082/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Write a haiku about AI"}],
    "stream": false,
    "max_tokens": 100
  }'

# Expected: Should return a haiku in 2-3 seconds
```

**Success Criteria**:

- ✅ Qwen responds to simple queries (<5s)
- ✅ GPT-OSS responds to creative queries (<3s)
- ✅ Both generate actual content (not empty)

---

## Phase 2: Routing Implementation (Days 2-3)

### Day 2: Implement Query Router

**Task**: Add intelligent routing logic

**File**: `backend/router/query_router.py` (new file)

```python
"""
Query Router - Determines which model to use for each query
"""

import re
from typing import Literal

ModelChoice = Literal["qwen_tools", "qwen_direct", "gpt_oss"]


class QueryRouter:
    """Routes queries to appropriate model based on intent"""

    def __init__(self):
        # Tool-required keywords (need web search/current info)
        self.tool_keywords = [
            r"\bweather\b", r"\btemperature\b", r"\bforecast\b",
            r"\bnews\b", r"\btoday\b", r"\blatest\b", r"\bcurrent\b",
            r"\bsearch\b", r"\bfind\b", r"\blookup\b",
            r"\bwhat'?s happening\b", r"\bright now\b"
        ]

        # Creative/conversational keywords
        self.creative_keywords = [
            r"\bwrite a\b", r"\bcreate a\b", r"\bgenerate\b",
            r"\bpoem\b", r"\bstory\b", r"\bhaiku\b", r"\bessay\b",
            r"\btell me a\b", r"\bjoke\b", r"\bimagine\b"
        ]

        # Code/technical keywords
        self.code_keywords = [
            r"\bcode\b", r"\bfunction\b", r"\bclass\b",
            r"\bbug\b", r"\berror\b", r"\bfix\b", r"\bdebug\b",
            r"\bimplement\b", r"\brefactor\b"
        ]

    def route(self, query: str) -> ModelChoice:
        """
        Determine which model to use

        Returns:
            "qwen_tools": Two-pass flow with web search/fetch
            "qwen_direct": Qwen for complex tasks, no tools
            "gpt_oss": GPT-OSS for simple/creative
        """
        query_lower = query.lower()

        # Priority 1: Tool-required queries
        for pattern in self.tool_keywords:
            if re.search(pattern, query_lower):
                return "qwen_tools"

        # Priority 2: Code/technical queries
        for pattern in self.code_keywords:
            if re.search(pattern, query_lower):
                return "qwen_direct"

        # Priority 3: Creative/simple queries
        for pattern in self.creative_keywords:
            if re.search(pattern, query_lower):
                return "gpt_oss"

        # Priority 4: Simple explanations
        if any(kw in query_lower for kw in ["what is", "define", "explain", "how does"]):
            # If asking about current events → needs tools
            if any(kw in query_lower for kw in ["latest", "current", "today", "now"]):
                return "qwen_tools"
            else:
                return "gpt_oss"  # Historical/general knowledge

        # Default: Use Qwen (more capable)
        if len(query.split()) > 30:  # Long query → complex
            return "qwen_direct"
        else:
            return "gpt_oss"  # Short query → probably simple


# Singleton instance
router = QueryRouter()


def route_query(query: str) -> ModelChoice:
    """Helper function to route a query"""
    return router.route(query)
```

**Test**:

```python
# backend/router/test_router.py
from query_router import route_query

test_cases = {
    "What's the weather in Paris?": "qwen_tools",
    "Latest news about AI": "qwen_tools",
    "Write a haiku about coding": "gpt_oss",
    "What is Docker?": "gpt_oss",
    "Fix this Python code": "qwen_direct",
    "Explain quantum physics": "gpt_oss",
}

for query, expected in test_cases.items():
    result = route_query(query)
    status = "✅" if result == expected else "❌"
    print(f"{status} '{query}' → {result} (expected: {expected})")
```

**Success Criteria**:

- ✅ All test cases route correctly
- ✅ Weather/news → qwen_tools
- ✅ Creative → gpt_oss
- ✅ Code → qwen_direct

---

### Day 3: Implement Two-Pass Tool Flow

**Task**: Add answer-mode firewall for Qwen

**File**: `backend/router/two_pass_flow.py` (new file)

```python
"""
Two-Pass Tool Flow - Prevents infinite loops
"""

import httpx
from typing import AsyncIterator, List, Dict


class TwoPassToolFlow:
    """
    Pass A: Plan & Execute tools (bounded)
    Pass B: Answer mode (tools disabled, firewall)
    """

    def __init__(self, qwen_url: str = "http://localhost:8080"):
        self.qwen_url = qwen_url
        self.client = httpx.AsyncClient(timeout=60.0)

    async def execute(
        self,
        query: str,
        messages: List[Dict]
    ) -> AsyncIterator[str]:
        """
        Execute two-pass flow:
        1. Plan & execute tools
        2. Generate answer with tools disabled
        """

        # Pass A: Execute tools (bounded)
        print(f"🔧 Pass A: Executing tools for query")
        findings = await self.execute_tools(query, messages)

        # Pass B: Answer mode (tools disabled)
        print(f"📝 Pass B: Generating answer (tools DISABLED)")
        async for chunk in self.answer_mode(query, findings):
            yield chunk

    async def execute_tools(self, query: str, messages: List[Dict]) -> str:
        """
        Pass A: Execute bounded tool calls
        Returns: findings (text summary of tool results)
        """

        # For MVP: Call current_info_agent with FORCE_RESPONSE_AFTER=2
        # This limits tool calls to 2 iterations max

        tool_messages = messages + [{
            "role": "user",
            "content": query
        }]

        findings = []

        # Call Qwen with tools, bounded to 2 iterations
        response = await self.client.post(
            f"{self.qwen_url}/v1/chat/completions",
            json={
                "messages": tool_messages,
                "tools": [
                    {
                        "type": "function",
                        "function": {
                            "name": "brave_web_search",
                            "description": "Search the web",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {"type": "string"}
                                }
                            }
                        }
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "fetch",
                            "description": "Fetch URL content",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "url": {"type": "string"}
                                }
                            }
                        }
                    }
                ],
                "stream": False,
                "max_tokens": 512
            },
            timeout=15.0  # 15s max for tools
        )

        # Extract tool results
        # (Simplified - real implementation needs tool execution)
        result = response.json()

        # For MVP, we'll collect tool results and format as findings
        findings_text = "Tool execution results:\n"
        findings_text += f"- Query: {query}\n"
        findings_text += f"- Results: [tool results would go here]\n"

        return findings_text

    async def answer_mode(self, query: str, findings: str) -> AsyncIterator[str]:
        """
        Pass B: Generate answer with tools DISABLED
        Firewall: Drop any tool_calls, force content output
        """

        system_prompt = (
            "You are in ANSWER MODE. Tools are disabled.\n"
            "Write a concise answer (2-4 sentences) from the findings below.\n"
            "Then list 1-2 URLs under 'Sources:'."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User asked: {query}\n\nFindings:\n{findings}"}
        ]

        # Call Qwen with tools=[] (DISABLED)
        response = await self.client.post(
            f"{self.qwen_url}/v1/chat/completions",
            json={
                "messages": messages,
                "tools": [],  # NO TOOLS
                "stream": True,
                "max_tokens": 384,
                "temperature": 0.2
            }
        )

        content_seen = False

        async for line in response.aiter_lines():
            if line.startswith("data: "):
                try:
                    import json
                    data = json.loads(line[6:])

                    if data.get("choices"):
                        delta = data["choices"][0].get("delta", {})

                        # FIREWALL: Drop tool calls
                        if "tool_calls" in delta:
                            print(f"⚠️  Firewall: Dropped hallucinated tool_call")
                            continue

                        # Stream content
                        if "content" in delta and delta["content"]:
                            content_seen = True
                            yield delta["content"]

                        # Stop on finish
                        finish_reason = data["choices"][0].get("finish_reason")
                        if finish_reason in ["stop", "length"]:
                            break

                except json.JSONDecodeError:
                    continue

        # Fallback if no content
        if not content_seen:
            print(f"❌ No content generated, returning findings")
            yield f"Based on search results: {findings[:200]}..."


# Singleton
two_pass_flow = TwoPassToolFlow()
```

**Success Criteria**:

- ✅ Pass A executes tools (bounded to 2 iterations)
- ✅ Pass B generates answer without calling tools
- ✅ Firewall drops any tool_calls in answer mode
- ✅ Always produces content (no blank responses)

---

## Phase 3: Integration (Day 4)

### Update Main Router

**File**: `backend/router/gpt_service.py`

**Changes**:

```python
from query_router import route_query
from two_pass_flow import two_pass_flow

class GptService:
    def __init__(self, config):
        self.qwen_url = "http://localhost:8080"
        self.gpt_oss_url = "http://localhost:8082"
        self.config = config

    async def stream_chat_request(
        self,
        messages: List[dict],
        reasoning_effort: str = "low",
        agent_name: str = "orchestrator",
        permitted_tools: List[str] = None,
    ):
        """Main entry point with routing"""

        # Get user query
        query = messages[-1]["content"] if messages else ""

        # Route query
        model_choice = route_query(query)
        print(f"🎯 Routing: '{query[:50]}...' → {model_choice}")

        if model_choice == "qwen_tools":
            # Two-pass flow for tool queries
            async for chunk in two_pass_flow.execute(query, messages):
                yield chunk

        elif model_choice == "gpt_oss":
            # Direct to GPT-OSS (creative/simple)
            async for chunk in self.direct_query(self.gpt_oss_url, messages):
                yield chunk

        else:  # qwen_direct
            # Direct to Qwen (no tools)
            async for chunk in self.direct_query(self.qwen_url, messages):
                yield chunk

    async def direct_query(self, url: str, messages: List[dict]):
        """Simple direct query (no tools)"""
        # Existing implementation for non-tool queries
        # ...existing code...
```

**Test End-to-End**:

```bash
# Start all services
cd /Users/alexmartinez/openq-ws/geistai/backend
./start-local-dev.sh
docker-compose --profile local up -d

# Test weather query (should use Qwen + tools)
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Paris?", "messages": []}' \
  --max-time 30

# Test creative query (should use GPT-OSS)
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a haiku about coding", "messages": []}' \
  --max-time 10

# Test simple query (should use GPT-OSS)
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Docker?", "messages": []}' \
  --max-time 10
```

**Success Criteria**:

- ✅ Weather query completes in <20s with answer
- ✅ Creative query completes in <5s
- ✅ Simple query completes in <5s
- ✅ All queries generate content (no blanks)
- ✅ No infinite loops

---

## Phase 4: Testing & Validation (Day 5)

### Run Full Test Suite

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/router

# Run test suite against new implementation
uv run python test_tool_calling.py \
    --model multi-model \
    --url http://localhost:8000 \
    --output validation_results.json
```

**Success Criteria** (from TOOL_CALLING_PROBLEM.md):

| Metric             | Target | Must Pass |
| ------------------ | ------ | --------- |
| Tool query success | ≥ 85%  | ✅        |
| Weather latency    | < 15s  | ✅        |
| Content generated  | 100%   | ✅        |
| Simple query time  | < 5s   | ✅        |
| No infinite loops  | 100%   | ✅        |

**If any metric fails**:

- Adjust routing keywords
- Tune answer-mode prompts
- Increase tool timeouts
- Add more firewall logic

---

## Phase 5: Production Deployment (Days 6-7)

### Day 6: Production Setup

**Update Production Config**:

```bash
# On production server
cd /path/to/geistai/backend

# Upload Qwen model
scp qwen2.5-coder-32b-instruct-q4_k_m.gguf user@prod:/path/to/models/

# Update Kubernetes/Docker config
# backend/inference/Dockerfile.gpu
```

**Update `docker-compose.yml`** for production:

```yaml
services:
  # Qwen 32B (tool queries)
  inference-qwen:
    image: ghcr.io/ggml-org/llama.cpp:server-cuda
    ports:
      - "8080:8080"
    volumes:
      - ./models:/models:ro
    environment:
      - MODEL_PATH=/models/qwen2.5-coder-32b-instruct-q4_k_m.gguf
      - CONTEXT_SIZE=32768
      - GPU_LAYERS=15
      - PARALLEL=2
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # GPT-OSS 20B (creative/simple)
  inference-gpt-oss:
    image: ghcr.io/ggml-org/llama.cpp:server-cuda
    ports:
      - "8082:8082"
    volumes:
      - ./models:/models:ro
    environment:
      - MODEL_PATH=/models/openai_gpt-oss-20b-Q4_K_S.gguf
      - CONTEXT_SIZE=8192
      - GPU_LAYERS=10
      - PARALLEL=2
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  router-local:
    # ... existing config ...
    environment:
      - INFERENCE_URL_QWEN=http://inference-qwen:8080
      - INFERENCE_URL_GPT_OSS=http://inference-gpt-oss:8082
      - MCP_BRAVE_URL=http://mcp-brave:8080/mcp # FIX PORT
      - MCP_FETCH_URL=http://mcp-fetch:8000/mcp
```

**Fix MCP Brave Port** (from GPU_BACKEND_ANALYSIS.md):

```yaml
mcp-brave:
  image: mcp/brave-search:latest
  environment:
    - BRAVE_API_KEY=${BRAVE_API_KEY}
    - PORT=8080 # Ensure port 8080
  ports:
    - "3001:8080" # CORRECT PORT MAPPING
```

---

### Day 7: Canary Rollout

**Rollout Strategy**:

1. **10% Traffic** (2 hours)

   ```bash
   kubectl set image deployment/geist-inference \
       inference=geist-inference:qwen-32b

   kubectl scale deployment/geist-inference-new --replicas=1
   kubectl scale deployment/geist-inference-old --replicas=9
   ```

   **Monitor**:

   - Success rate ≥ 85%
   - P95 latency < 20s
   - Error rate < 5%

2. **50% Traffic** (4 hours)

   ```bash
   kubectl scale deployment/geist-inference-new --replicas=5
   kubectl scale deployment/geist-inference-old --replicas=5
   ```

   **Monitor**: Same metrics

3. **100% Traffic** (24 hours)

   ```bash
   kubectl scale deployment/geist-inference-new --replicas=10
   kubectl scale deployment/geist-inference-old --replicas=0
   ```

   **Monitor**: Full metrics for 24h

**Rollback Plan**:

```bash
# If any metric fails
kubectl rollout undo deployment/geist-inference
kubectl scale deployment/geist-inference-old --replicas=10
kubectl scale deployment/geist-inference-new --replicas=0
```

---

## Monitoring & Observability

### Metrics to Track

**Query Distribution**:

```
qwen_tools:   30% (weather, news, search)
qwen_direct:  20% (code, complex)
gpt_oss:      50% (creative, simple)
```

**Performance**:

```
Avg latency:     4-6 seconds
P95 latency:     12-18 seconds
P99 latency:     20-25 seconds
Success rate:    ≥ 90%
Blank responses: 0%
Infinite loops:  0%
```

**Cost**:

```
Self-hosted:  $0/month
API fallback: <$5/month (optional)
```

---

## Rollback & Contingency

### If Qwen Fails Validation

**Option 1**: Simplify to Qwen-only

```python
# Disable routing, use only Qwen
def route_query(query: str) -> str:
    return "qwen_direct"  # Skip GPT-OSS
```

**Option 2**: Add API Fallback

```python
# In two_pass_flow.py
if not content_seen:
    # Fallback to Claude
    async for chunk in call_claude_api(query, findings):
        yield chunk
```

**Option 3**: Try Alternative Model

```bash
# Download Llama 3.1 70B
wget https://huggingface.co/.../Llama-3.1-70B-Instruct-Q4_K_M.gguf
# Use instead of Qwen
```

---

## Success Criteria Summary

### Week 1 (MVP):

- ✅ Qwen downloaded and running
- ✅ Routing implemented
- ✅ Two-pass flow working
- ✅ 85%+ tool query success
- ✅ <20s P95 latency
- ✅ 0% blank responses

### Week 2 (Optimization):

- ✅ Deployed to production
- ✅ 90%+ overall success
- ✅ <15s average latency
- ✅ Monitoring dashboards live

### Month 1 (Polish):

- ✅ >95% success rate
- ✅ <10s average latency
- ✅ Caching implemented
- ✅ ML-based routing (optional)

---

## File Changes Summary

### New Files:

```
backend/router/query_router.py       # Routing logic
backend/router/two_pass_flow.py      # Answer-mode firewall
backend/router/test_router.py        # Router tests
```

### Modified Files:

```
backend/start-local-dev.sh           # Multi-model startup
backend/router/gpt_service.py        # Add routing
backend/docker-compose.yml           # Multi-model config
```

### Documentation:

```
TOOL_CALLING_PROBLEM.md              # Problem analysis ✅
GPU_BACKEND_ANALYSIS.md              # GPU differences ✅
GPT_OSS_USAGE_OPTIONS.md             # Keep GPT-OSS ✅
FINAL_IMPLEMENTATION_PLAN.md         # This document ✅
```

---

## Timeline Checklist

- [ ] **Day 1 AM**: Download Qwen (2-3h)
- [ ] **Day 1 PM**: Configure multi-model setup
- [ ] **Day 1 Eve**: Test basic functionality
- [ ] **Day 2**: Implement routing
- [ ] **Day 3**: Implement two-pass flow
- [ ] **Day 4**: Integration & testing
- [ ] **Day 5**: Validation & tuning
- [ ] **Day 6**: Production setup
- [ ] **Day 7**: Canary rollout

**Total**: 5-7 days to fully functional MVP

---

## Contact & Support

**Questions?**

- Review `TOOL_CALLING_PROBLEM.md` for background
- Check `GPU_BACKEND_ANALYSIS.md` for hardware questions
- See `GPT_OSS_USAGE_OPTIONS.md` for model selection

**Blocked?**

- Test individual components first
- Check logs: `/tmp/geist-*.log`
- Verify health endpoints

**Ready?** Start with Day 1: Download Qwen! 🚀
