# Testing Instructions: GPT-OSS 20B vs Llama 3.1 8B

## 🎯 Goal

Empirically validate whether Llama 3.1 8B should replace GPT-OSS 20B by running side-by-side comparisons.

---

## 📋 Test Plan Overview

We'll run **9 comprehensive tests** covering all use cases:

- **3 Answer Mode tests** (post-tool execution)
- **3 Creative tests** (poems, jokes, stories)
- **2 Knowledge tests** (definitions, explanations)
- **1 Math test** (simple logic)

**Each test checks for**:

- ✅ Harmony format artifacts (`<|channel|>`, meta-commentary)
- ✅ Response speed (first token, total time)
- ✅ Response quality (coherence, completeness)
- ✅ Sources inclusion (when applicable)

---

## 🚀 Quick Start (5 Steps)

### Step 1: Ensure GPT-OSS is Running

```bash
# Check if GPT-OSS is running
lsof -i :8082

# If not running, start your local dev environment
cd /Users/alexmartinez/openq-ws/geistai/backend
./start-local-dev.sh
```

**Expected**: GPT-OSS running on port 8082, Qwen on port 8080

---

### Step 2: Set Up Llama 3.1 8B for Testing

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend
./setup_llama_test.sh
```

**This script will**:

1. Check if Llama model is downloaded (~5GB)
2. Download it if needed (10-30 minutes depending on internet)
3. Start Llama on port 8083 (different from GPT-OSS)
4. Run health checks
5. Quick validation test

**Expected output**:

```
✅ Llama started (PID: XXXXX)
✅ Llama 3.1 8B: http://localhost:8083 - Healthy
✅ GPT-OSS 20B: http://localhost:8082 - Healthy
✅ Clean response (no artifacts detected)
```

---

### Step 3: Run Comparison Test

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/router
uv run python compare_models.py
```

**What it does**:

- Tests 9 queries on GPT-OSS 20B
- Tests same 9 queries on Llama 3.1 8B
- Compares: artifact rate, speed, quality
- Generates comprehensive summary
- Saves detailed results to `/tmp/model_comparison_*.json`

**Duration**: ~5-10 minutes (includes wait times between tests)

---

### Step 4: Review Results

The test will print a comprehensive summary:

```
📊 COMPREHENSIVE SUMMARY
====================================

🎯 Overall Statistics:
  GPT-OSS 20B:
    Clean responses:     X/9 (XX%)
    Avg response time:   X.XXs
    Avg quality score:   X.X/10

  Llama 3.1 8B:
    Clean responses:     X/9 (XX%)
    Avg response time:   X.XXs
    Avg quality score:   X.X/10

🏆 WINNER DETERMINATION
====================================
  ✅ Overall Winner: [Llama 3.1 8B / GPT-OSS 20B]
  ✅ RECOMMENDATION: [Replace / Keep / Review]
```

---

### Step 5: Make Decision

**Decision criteria**:

✅ **Replace GPT-OSS if**:

- Llama has significantly fewer artifacts (>30% improvement)
- Llama speed is similar or better
- Llama quality is acceptable

⚠️ **Need more testing if**:

- Results are close (within 10%)
- Quality differences are significant
- Unexpected issues appear

❌ **Keep GPT-OSS if** (unlikely):

- GPT-OSS is cleaner (unexpected!)
- Llama has severe quality issues
- Llama is much slower

---

## 📊 What Gets Tested

### Test Categories

#### 1. Answer Mode (Post-Tool Execution)

**Simulates**: After Qwen executes tools, model generates final answer

**Test queries**:

- "What is the weather in Paris?" + weather findings
- "Latest AI news" + news findings

**Checks**:

- Artifacts in summary
- Sources included
- Concise (2-3 sentences)

---

#### 2. Creative Queries

**Simulates**: Direct creative requests (no tools)

**Test queries**:

- "Tell me a programming joke"
- "Write a haiku about coding"
- "Create a short story about a robot"

**Checks**:

- Creativity
- Artifacts
- Completeness

---

#### 3. Knowledge Queries

**Simulates**: Simple explanations (no tools)

**Test queries**:

- "What is Docker?"
- "Explain how HTTP works"

**Checks**:

- Accuracy
- Clarity
- Artifacts

---

#### 4. Math/Logic

**Simulates**: Simple reasoning

**Test query**:

- "What is 2+2?"

**Checks**:

- Correctness
- No over-complication

---

## 🔍 Artifact Detection

The test automatically detects these artifacts:

### Harmony Format Markers

```
<|channel|>analysis<|message|>
<|end|>
<|start|>
assistantanalysis
```

### Meta-Commentary

```
"We need to check..."
"The user asks..."
"Let's browse..."
"Our task is..."
"I should..."
```

### Hallucinated Tools

```
to=browser.open
{"cursor": 0, "id": "..."}
```

**Scoring**:

- **Clean response**: 0 artifacts = ✅
- **Minor artifacts**: 1-2 patterns = ⚠️
- **Severe artifacts**: 3+ patterns = ❌

---

## 📁 Output Files

### Console Output

Real-time results as tests run:

- Each query result
- Timing information
- Artifact detection
- Quality scoring

### JSON Results

Detailed results saved to:

```
/tmp/model_comparison_YYYYMMDD_HHMMSS.json
```

**Contains**:

- Full response text for each query
- Timing metrics
- Artifact details
- Quality scores
- Comparison data

---

## 🐛 Troubleshooting

### Issue: GPT-OSS not responding

**Solution**:

```bash
# Check if running
lsof -i :8082

# If not, start local dev
cd backend
./start-local-dev.sh
```

---

### Issue: Llama download fails

**Solution**:

```bash
# Manual download
cd backend/inference/models
wget https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf

# Verify size (~5GB)
ls -lh Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf
```

---

### Issue: Llama won't start

**Check logs**:

```bash
tail -f /tmp/geist-llama-test.log
```

**Common causes**:

- Port 8083 in use: `kill $(lsof -ti :8083)`
- Model file corrupted: Re-download
- Insufficient memory: Close other applications

---

### Issue: Tests timeout

**Solution**:

```bash
# Increase timeout in compare_models.py
# Change: httpx.AsyncClient(timeout=30.0)
# To:     httpx.AsyncClient(timeout=60.0)
```

---

## 📈 Expected Results

Based on analysis, we expect:

### Artifact Rate

- **GPT-OSS**: 40-60% (high)
- **Llama**: 0-10% (low)
- **Winner**: Llama ✅

### Speed

- **GPT-OSS**: 2-3s
- **Llama**: 2-3s (similar)
- **Winner**: Tie

### Quality

- **GPT-OSS**: Good (7/10)
- **Llama**: Good (8/10)
- **Winner**: Llama ✅

### Overall

**Expected winner**: **Llama 3.1 8B** (2 out of 3 metrics)

---

## ⚠️ Important Notes

### 1. Test Port Usage

- GPT-OSS: **8082** (production port, keep as is)
- Llama: **8083** (test port, temporary)

After validation, if replacing, Llama will move to port 8082.

### 2. Resource Usage

Running both models simultaneously requires:

- **Mac M4 Pro**: ~23GB unified memory (within 36GB limit) ✅
- **Production**: May need sequential loading or 2 GPUs

### 3. Test Duration

- Setup: 10-40 minutes (mostly download)
- Tests: 5-10 minutes (9 queries × 2 models)
- **Total**: 15-50 minutes

### 4. Non-Destructive

This test:

- ✅ Does NOT change your existing setup
- ✅ Does NOT modify any code
- ✅ Runs Llama on different port (8083)
- ✅ Easy cleanup (just kill Llama process)

---

## 🎓 Interpreting Results

### Scenario A: Clear Winner (Llama wins 2-3 metrics)

**Action**: Replace GPT-OSS with Llama
**Confidence**: High
**Next**: Update `start-local-dev.sh`, deploy

### Scenario B: Close Call (Each wins ~1 metric)

**Action**: Run more tests, review quality subjectively
**Confidence**: Medium
**Next**: Extended testing, team review

### Scenario C: GPT-OSS Wins (unlikely)

**Action**: Keep GPT-OSS, investigate Llama issues
**Confidence**: Low (this would be surprising)
**Next**: Check model version, try different quantization

---

## 🚀 After Testing

### If Llama Wins (Expected)

**1. Update Production Script**

```bash
# Edit backend/start-local-dev.sh
# Line 25: Change model path
LLAMA_MODEL="$BACKEND_DIR/inference/models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

# Update llama-server command to use port 8082
# (replacing GPT-OSS)
```

**2. Stop Test Instance**

```bash
# Kill Llama test instance on 8083
kill $(lsof -ti :8083)
```

**3. Restart with New Configuration**

```bash
cd backend
./start-local-dev.sh
```

**4. Validate Production**

```bash
# Test on production port (8082, now Llama)
curl http://localhost:8082/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "stream": false}'
```

**5. Run Full Test Suite**

```bash
cd backend/router
uv run python test_mvp_queries.py
```

---

### If GPT-OSS Wins (Unexpected)

**1. Document Findings**

- Save test results
- Note specific issues with Llama
- Share with team

**2. Investigate**

- Try different Llama quantization (Q5, Q6)
- Try Llama 3.1 70B (if VRAM allows)
- Try different prompts

**3. Consider Alternatives**

- Option B from `FIX_OPTIONS_COMPARISON.md`: Accumulate→parse
- Option C: Grammar constraints
- Option F: Template fix

---

## 📞 Need Help?

Check these documents:

- `LLAMA_VS_GPT_OSS_VALIDATION.md` - Full validation plan
- `LLAMA_REPLACEMENT_DECISION.md` - Complete analysis
- `HARMONY_FORMAT_DEEP_DIVE.md` - Artifact details
- `FIX_OPTIONS_COMPARISON.md` - All solution options

---

## ✅ Checklist

- [ ] GPT-OSS running on port 8082
- [ ] Llama downloaded (~5GB)
- [ ] Llama running on port 8083
- [ ] Health checks pass for both models
- [ ] Comparison test runs successfully
- [ ] Results reviewed and understood
- [ ] Decision made (replace / keep / test more)
- [ ] If replacing: `start-local-dev.sh` updated
- [ ] If replacing: Full test suite passes
- [ ] Test instance cleaned up (port 8083)

---

**Ready to start testing?** 🧪

Run: `./backend/setup_llama_test.sh`
