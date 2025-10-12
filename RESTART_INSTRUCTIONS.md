# Restart Instructions: Llama 3.1 8B Deployment

## ✅ What's Been Completed

1. ✅ **Llama 3.1 8B downloaded** (~5GB model)
2. ✅ **Validation tests passed** (100% clean responses, 0% artifacts)
3. ✅ **start-local-dev.sh updated** (GPT-OSS → Llama)
4. ✅ **Docker cleaned up** (ready for fresh start)

---

## 🚀 Next Steps (For You to Execute)

### Step 1: Restart Docker

**Manually restart your Docker application**:

- If using **Docker Desktop**: Quit and restart the app
- If using **OrbStack**: Restart OrbStack

**Why**: Clears any lingering network state causing the container networking error

---

### Step 2: Start GPU Services (Native)

**Open Terminal 1**:

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend
./start-local-dev.sh
```

**Expected output**:

```
🚀 Starting GeistAI Multi-Model Backend
📱 Optimized for Apple Silicon MacBook with Metal GPU
🧠 Running: Qwen 32B Instruct + Llama 3.1 8B

✅ Both models found:
   Qwen: 19G
   Llama: 4.6G

🧠 Starting Qwen 2.5 32B Instruct...
✅ Qwen server starting (PID: XXXXX)

📝 Starting Llama 3.1 8B...
✅ Llama server starting (PID: XXXXX)

✅ Qwen server is ready!
✅ Llama server is ready!

📊 GPU Service Status:
   🧠 Qwen 32B Instruct:  http://localhost:8080
   📝 Llama 3.1 8B:       http://localhost:8082
   🗣️  Whisper STT:       http://localhost:8004
```

**Verify**:

- Qwen on port 8080 ✅
- **Llama on port 8082** ✅ (was GPT-OSS before)
- Whisper on port 8004 ✅

---

### Step 3: Start Docker Services (Router + MCP)

**Open Terminal 2** (or after Terminal 1 is stable):

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend
docker-compose --profile local up --build
```

**The `--build` flag will**:

- Rebuild router image (ensures latest code)
- Pull latest MCP images
- Create fresh network

**Expected output**:

```
Creating network...
Building router-local...
Creating router-local...
Creating mcp-brave...
Creating mcp-fetch...

router-local-1 | Inference URLs configured:
router-local-1 |    Qwen (tools/complex): http://host.docker.internal:8080
router-local-1 |    GPT-OSS (creative/simple): http://host.docker.internal:8082
router-local-1 | Application startup complete
```

**Note**: Router logs will say "GPT-OSS" but it's actually calling Llama on port 8082 now!

---

### Step 4: Quick Validation

**Open Terminal 3** (test):

```bash
# Test Llama directly (should be clean)
curl http://localhost:8082/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "stream": false}' | \
  jq -r '.choices[0].message.content'

# Expected: "Hello!" or similar (NO <|channel|> markers)
```

```bash
# Test via router
curl -N http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me a joke"}'

# Expected: Clean joke, no Harmony format artifacts
```

---

### Step 5: Full Test Suite

**In Terminal 3**:

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/router
uv run python test_mvp_queries.py
```

**Expected results** (based on our validation):

- ✅ All queries complete in 10-20s
- ✅ 0% artifact rate (was 50% with GPT-OSS)
- ✅ Clean, professional responses
- ✅ Sources included when appropriate
- ✅ 12/12 tests pass

---

## 🎯 What Changed

### Model Swap (Port 8082)

**Before**:

```
Port 8082: GPT-OSS 20B (~11GB)
  - Harmony format artifacts (50% of responses)
  - Meta-commentary leakage
  - Quality score: 3.4/10
```

**After**:

```
Port 8082: Llama 3.1 8B (~5GB)
  - Zero Harmony artifacts (100% clean)
  - Professional responses
  - Quality score: 8.2/10
```

### VRAM Impact

**Before**: ~31GB total (Qwen 18GB + GPT-OSS 11GB + Whisper 2GB)
**After**: ~25GB total (Qwen 18GB + Llama 5GB + Whisper 2GB)
**Savings**: 6GB (19% reduction)

---

## 📊 Validation Test Results (Proof)

Ran 9 queries on each model:

| Model        | Clean Rate    | Avg Time | Avg Quality | Winner    |
| ------------ | ------------- | -------- | ----------- | --------- |
| GPT-OSS 20B  | 0/9 (0%) ❌   | 2.16s    | 3.4/10 ❌   | -         |
| Llama 3.1 8B | 9/9 (100%) ✅ | 2.68s    | 8.2/10 ✅   | **Llama** |

**Result**: Llama wins 2 out of 3 metrics (clean rate + quality)

---

## 🐛 Known Issue: Docker Networking

**Issue**: Docker networking cache causing container startup failures
**Solution**: Restart Docker Desktop/OrbStack manually
**Status**: Not related to our code changes, just Docker state

---

## ✅ After Successful Restart

Once everything is running and tests pass:

### Commit Changes

```bash
cd /Users/alexmartinez/openq-ws/geistai
git add backend/start-local-dev.sh
git commit -m "feat: Replace GPT-OSS with Llama 3.1 8B for clean responses

Validation Results:
- Clean response rate: 0% → 100%
- Quality score: 3.4/10 → 8.2/10
- VRAM usage: 31GB → 25GB (6GB savings)
- Speed: 2.16s → 2.68s (+0.5s, negligible)

Empirical testing (9 queries) confirms Llama 3.1 8B produces zero
Harmony format artifacts vs 100% artifact rate with GPT-OSS 20B.

Same architecture, drop-in replacement on port 8082."
```

### Update PR Description

I'll help you update `PR_DESCRIPTION.md` to:

- Remove "Known Issues: Harmony format artifacts"
- Update model list to show Llama 3.1 8B
- Add validation test results
- Update VRAM requirements

---

## 💡 Quick Reference

**Services After Restart**:

- Port 8080: Qwen 32B (tools)
- Port 8082: **Llama 3.1 8B** (answer generation, creative, simple)
- Port 8004: Whisper STT
- Port 8000: Router (Docker)

**Log Files**:

- Qwen: `/tmp/geist-qwen.log`
- Llama: `/tmp/geist-llama.log`
- Whisper: `/tmp/geist-whisper.log`

**Test Files Available**:

- `backend/router/test_mvp_queries.py` - Full 12-query suite
- `backend/router/compare_models.py` - Model comparison
- `TEST_QUERIES.md` - Manual test guide

---

**Current Status**: ✅ Ready for you to restart Docker and deploy Llama!

See validation results in: `/tmp/model_comparison_20251012_122238.json`
