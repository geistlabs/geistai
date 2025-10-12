# Llama 3.1 8B vs GPT-OSS 20B: Validation Plan

## 🎯 Goal

Validate whether replacing GPT-OSS 20B with Llama 3.1 8B Instruct improves response quality (reduces artifacts) without sacrificing speed or quality.

---

## 📊 Test Categories

### 1. Artifact Rate (Most Important)

**What to measure**: How many responses have Harmony format artifacts?

**Test queries** (10 samples each model):

- "What is the weather in Paris?"
- "Tell me a programming joke"
- "What is Docker?"
- "Write a haiku about AI"
- "Explain how HTTP works"
- "What are the latest AI news?"
- "Create a short story about a robot"
- "Define machine learning"
- "Latest NBA scores"
- "What is Python?"

**Success criteria**:

- Llama 3.1 8B: <10% artifacts
- GPT-OSS 20B: Current ~50% artifacts

---

### 2. Response Speed

**What to measure**: Time to first token + total generation time

**Test setup**: Same queries as above

**Success criteria**:

- Llama 3.1 8B should be ≤ GPT-OSS speed (ideally faster)
- Target: <5s for simple queries, <3s for answer mode

---

### 3. Response Quality

**What to measure**: Coherence, accuracy, helpfulness

**Evaluation dimensions**:

- Does it answer the question?
- Is the answer accurate?
- Is it concise (2-5 sentences)?
- Does it include sources when needed?

**Success criteria**:

- Llama quality ≥ GPT-OSS quality (subjective but measurable)

---

### 4. VRAM Usage

**What to measure**: Memory consumption

**Success criteria**:

- Llama 3.1 8B: ~5GB (vs GPT-OSS ~11GB)

---

### 5. Model Compatibility

**What to measure**: Does it work with existing infrastructure?

**Test**:

- Loads in llama.cpp ✅
- Responds to chat format ✅
- Handles system prompts ✅
- Works with streaming ✅

---

## 🧪 Validation Steps

### Step 1: Download Llama 3.1 8B (No Risk)

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/inference/models

# Download Llama 3.1 8B Instruct Q4_K_M quantization
wget https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf

# Verify download
ls -lh Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf
# Should be ~5GB
```

**Time**: 10-30 minutes (depending on internet speed)

---

### Step 2: Test Llama 3.1 8B in Isolation (Before Integration)

**Start Llama on a different port temporarily**:

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/whisper.cpp

./build/bin/llama-server \
    -m ../inference/models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
    --host 0.0.0.0 \
    --port 8083 \
    --ctx-size 8192 \
    --n-gpu-layers 32 \
    --threads 0 \
    --cont-batching \
    --parallel 2 \
    --batch-size 256 \
    --ubatch-size 128 \
    --mlock
```

**Test it directly**:

```bash
# Simple test
curl http://localhost:8083/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me a programming joke"}
    ],
    "stream": false,
    "max_tokens": 100
  }'

# Check for artifacts
# Look for: <|channel|>, "We need to", "The user asks", etc.
```

**Expected output (clean)**:

```json
{
  "choices": [
    {
      "message": {
        "content": "Why do programmers prefer dark mode? Because light attracts bugs!"
      }
    }
  ]
}
```

**If you see Harmony artifacts here, STOP - Llama isn't the solution.**

---

### Step 3: Side-by-Side Comparison Test

**Create a comparison script**:

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/router

cat > test_llama_vs_gptoss.py << 'EOF'
#!/usr/bin/env python3
"""
Compare Llama 3.1 8B vs GPT-OSS 20B for answer generation
"""
import httpx
import json
import time
from datetime import datetime

# Test queries
TEST_QUERIES = [
    "Tell me a programming joke",
    "What is Docker?",
    "Write a haiku about coding",
    "Explain how HTTP works",
    "What is machine learning?",
]

async def test_model(url: str, query: str, model_name: str):
    """Test a single query against a model"""
    print(f"\n{'='*60}")
    print(f"Testing: {model_name}")
    print(f"Query: {query}")
    print(f"{'='*60}")

    messages = [{"role": "user", "content": query}]

    start = time.time()
    response_text = ""
    first_token_time = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            f"{url}/v1/chat/completions",
            json={"messages": messages, "stream": True, "max_tokens": 150}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    if line.strip() == "data: [DONE]":
                        break
                    try:
                        data = json.loads(line[6:])
                        if "choices" in data and len(data["choices"]) > 0:
                            delta = data["choices"][0].get("delta", {})
                            if "content" in delta and delta["content"]:
                                if first_token_time is None:
                                    first_token_time = time.time() - start
                                response_text += delta["content"]
                    except json.JSONDecodeError:
                        continue

    total_time = time.time() - start

    # Check for artifacts
    artifacts = []
    if "<|channel|>" in response_text:
        artifacts.append("Harmony markers")
    if "We need to" in response_text or "The user asks" in response_text:
        artifacts.append("Meta-commentary")
    if "assistantanalysis" in response_text:
        artifacts.append("Malformed channels")
    if '{"cursor"' in response_text or 'to=browser' in response_text:
        artifacts.append("Hallucinated tools")

    # Print results
    print(f"\n📄 Response:")
    print(response_text[:300])
    if len(response_text) > 300:
        print("...(truncated)")

    print(f"\n⏱️  Timing:")
    print(f"  First token: {first_token_time:.2f}s")
    print(f"  Total time:  {total_time:.2f}s")
    print(f"  Length:      {len(response_text)} chars")

    print(f"\n🔍 Artifacts:")
    if artifacts:
        print(f"  ❌ Found: {', '.join(artifacts)}")
    else:
        print(f"  ✅ None detected")

    return {
        "model": model_name,
        "query": query,
        "response": response_text,
        "first_token_time": first_token_time,
        "total_time": total_time,
        "artifacts": artifacts,
        "clean": len(artifacts) == 0
    }

async def run_comparison():
    """Run full comparison"""
    print("🧪 Llama 3.1 8B vs GPT-OSS 20B Comparison Test")
    print(f"Started: {datetime.now()}")

    results = []

    for query in TEST_QUERIES:
        # Test Llama
        llama_result = await test_model(
            "http://localhost:8083",
            query,
            "Llama 3.1 8B"
        )
        results.append(llama_result)

        # Wait a bit
        time.sleep(2)

        # Test GPT-OSS
        gptoss_result = await test_model(
            "http://localhost:8082",
            query,
            "GPT-OSS 20B"
        )
        results.append(gptoss_result)

        time.sleep(2)

    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)

    llama_results = [r for r in results if r["model"] == "Llama 3.1 8B"]
    gptoss_results = [r for r in results if r["model"] == "GPT-OSS 20B"]

    llama_clean = sum(1 for r in llama_results if r["clean"])
    gptoss_clean = sum(1 for r in gptoss_results if r["clean"])

    llama_avg_time = sum(r["total_time"] for r in llama_results) / len(llama_results)
    gptoss_avg_time = sum(r["total_time"] for r in gptoss_results) / len(gptoss_results)

    print(f"\nLlama 3.1 8B:")
    print(f"  Clean responses: {llama_clean}/{len(llama_results)} ({llama_clean/len(llama_results)*100:.0f}%)")
    print(f"  Avg time: {llama_avg_time:.2f}s")

    print(f"\nGPT-OSS 20B:")
    print(f"  Clean responses: {gptoss_clean}/{len(gptoss_results)} ({gptoss_clean/len(gptoss_results)*100:.0f}%)")
    print(f"  Avg time: {gptoss_avg_time:.2f}s")

    print(f"\n✅ Winner:")
    if llama_clean > gptoss_clean:
        print(f"  Llama 3.1 8B (cleaner by {llama_clean - gptoss_clean} responses)")
    elif gptoss_clean > llama_clean:
        print(f"  GPT-OSS 20B (cleaner by {gptoss_clean - llama_clean} responses)")
    else:
        print(f"  Tie on cleanliness")

    if llama_avg_time < gptoss_avg_time:
        print(f"  Llama 3.1 8B is faster by {gptoss_avg_time - llama_avg_time:.2f}s")
    else:
        print(f"  GPT-OSS 20B is faster by {llama_avg_time - gptoss_avg_time:.2f}s")

    # Save results
    with open("/tmp/llama_vs_gptoss_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n💾 Detailed results saved to: /tmp/llama_vs_gptoss_results.json")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_comparison())
EOF

chmod +x test_llama_vs_gptoss.py
```

---

### Step 4: Run the Comparison

**Prerequisites**:

- GPT-OSS running on port 8082
- Llama 3.1 8B running on port 8083 (from Step 2)

```bash
# Make sure both are running
lsof -ti:8082  # Should show GPT-OSS
lsof -ti:8083  # Should show Llama

# Run comparison
cd /Users/alexmartinez/openq-ws/geistai/backend/router
uv run python test_llama_vs_gptoss.py
```

**What to look for**:

- ✅ Llama has <10% artifacts
- ✅ Llama is similar or faster speed
- ✅ Llama responses are coherent and helpful
- ❌ GPT-OSS has ~50% artifacts (confirming current state)

---

### Step 5: Integrate Llama (If Validation Passes)

**Only if Step 4 shows Llama is better**, then update your system:

```bash
# Stop services
cd /Users/alexmartinez/openq-ws/geistai/backend
./stop-services.sh  # Or manually kill

# Update start-local-dev.sh
# Change GPT-OSS to Llama on port 8082
```

---

## 📋 Decision Matrix

After running tests, use this to decide:

| Metric                          | Llama 3.1 8B | GPT-OSS 20B | Winner   |
| ------------------------------- | ------------ | ----------- | -------- |
| Artifact rate (lower is better) | \_\_\_%      | \_\_\_%     | ?        |
| Speed (lower is better)         | \_\_\_s      | \_\_\_s     | ?        |
| Response quality (1-5)          | \_\_\_       | \_\_\_      | ?        |
| VRAM usage (lower is better)    | ~5GB         | ~11GB       | Llama ✅ |

**Decision rule**:

- If Llama wins on artifacts + (speed OR quality) → **Replace GPT-OSS**
- If Llama ties on artifacts but wins on speed → **Replace GPT-OSS**
- If GPT-OSS is significantly better on quality → **Keep GPT-OSS, improve post-processing**

---

## 🎯 Expected Outcome

Based on industry experience and model characteristics, I expect:

**Llama 3.1 8B**:

- Artifact rate: 0-10% ✅
- Speed: 2-4s (similar or faster) ✅
- Quality: Good (comparable) ✅
- VRAM: 5GB ✅

**GPT-OSS 20B**:

- Artifact rate: 40-60% ❌
- Speed: 2-5s ✅
- Quality: Good ✅
- VRAM: 11GB ❌

**Conclusion**: Llama should win on artifacts and VRAM, tie on quality/speed.

---

## ⚠️ Risks & Mitigation

### Risk 1: Llama 3.1 8B has artifacts too

**Mitigation**: Test in Step 2 before integrating
**Fallback**: Try Llama 3.3 70B (if you have VRAM) or API fallback

### Risk 2: Llama quality is worse

**Mitigation**: Subjective comparison in Step 4
**Fallback**: Use Llama for answer mode only, keep GPT-OSS for creative

### Risk 3: Integration breaks something

**Mitigation**: Test on port 8083 first, only move to 8082 after validation
**Fallback**: Quick rollback (just change model path)

---

## 📝 Validation Checklist

- [ ] Download Llama 3.1 8B
- [ ] Test Llama in isolation (port 8083)
- [ ] Verify no Harmony artifacts in Llama responses
- [ ] Run side-by-side comparison script
- [ ] Analyze results (artifact rate, speed, quality)
- [ ] Make decision based on data
- [ ] If proceed: Update start-local-dev.sh
- [ ] If proceed: Test full system with Llama
- [ ] If proceed: Update PR description
- [ ] If not proceed: Document why and try Option B (accumulate→parse)

---

## 💡 Quick Validation (5 Minutes)

If you want a FAST validation before the full test:

```bash
# 1. Download Llama (if not already done)
cd /Users/alexmartinez/openq-ws/geistai/backend/inference/models
wget https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf

# 2. Start it on port 8083
cd ../whisper.cpp
./build/bin/llama-server \
    -m ../inference/models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
    --port 8083 \
    --n-gpu-layers 32 &

# 3. Test it
curl http://localhost:8083/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Tell me a joke about programming"}], "stream": false}' \
  | jq -r '.choices[0].message.content'

# 4. Check for artifacts
# If you see clean text → Llama is good!
# If you see <|channel|> or "We need to" → Llama has same issue
```

This 5-minute test will tell you immediately if Llama is worth pursuing.

---

Want me to help you run these validation tests?
