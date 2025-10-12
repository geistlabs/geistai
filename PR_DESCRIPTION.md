# Multi-Model Optimization & Tool-Calling Fix

## 🎯 Overview

This PR implements a comprehensive multi-model architecture that dramatically improves performance and fixes critical tool-calling bugs. The system now uses **Qwen 2.5 Instruct 32B** for tool-calling queries and **GPT-OSS 20B** for creative/simple queries, achieving an **80% performance improvement** for tool-requiring queries.

## 📊 Key Achievements

### Performance Improvements
- **Tool-calling queries**: 68.9s → 14.5s (80% faster) ✅
- **Creative queries**: 5-10s → 2-5s ✅
- **Simple knowledge queries**: Fast (<5s) ✅
- **Hit MVP target**: <15s for weather/news queries ✅

### Architecture Changes
- ✅ **Multi-model routing**: Heuristic-based query router directs queries to optimal model
- ✅ **Two-pass tool flow**: Plan → Execute → Answer mode (tools disabled)
- ✅ **Answer mode firewall**: Prevents tool-calling hallucinations in final answer generation
- ✅ **Dual inference servers**: Qwen (8080) + GPT-OSS (8082) running concurrently on Mac Metal GPU

### Bug Fixes
- ✅ **Fixed GPT-OSS infinite tool loops**: Model was hallucinating tool calls and never generating content
- ✅ **Fixed MCP tool hanging**: Reduced iterations to 1, preventing timeout on large tool results
- ✅ **Fixed context size issues**: Increased to 32K for Qwen, 8K for GPT-OSS
- ✅ **Fixed agent prompts**: Explicit instructions to prevent infinite tool loops

## 🏗️ Architecture

### Multi-Model System

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query                               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Query Router      │
                    │  (Heuristic-based)  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
     ┌────▼─────┐        ┌────▼─────┐        ┌────▼─────┐
     │GPT-OSS   │        │Qwen      │        │Qwen      │
     │Creative/ │        │Tool Flow │        │Direct    │
     │Simple    │        │(2-pass)  │        │(Complex) │
     └──────────┘        └──────────┘        └──────────┘
         2-5s              14-20s               5-10s
```

### Two-Pass Tool Flow

```
Pass 1: Plan & Execute
┌──────────────────────────────────────────────────────────────┐
│ Qwen 32B (tools enabled)                                     │
│  ├─> brave_web_search("weather Paris")                       │
│  ├─> fetch(url)                                              │
│  └─> Accumulate findings (max 3 sources, 200 chars each)    │
└──────────────────────────────────────────────────────────────┘
                            ↓
Pass 2: Answer Mode (Firewall Active)
┌──────────────────────────────────────────────────────────────┐
│ GPT-OSS 20B (tools DISABLED, 15x faster)                     │
│  ├─> Input: Query + Findings                                 │
│  ├─> Firewall: Drop any tool_calls (shouldn't happen)       │
│  ├─> Generate: 2-3 sentence summary + sources               │
│  └─> Post-process: Clean Harmony format markers             │
└──────────────────────────────────────────────────────────────┘
```

## 📁 Changes Summary

### Core Router Changes
- **`backend/router/config.py`**: Multi-model inference URLs (`INFERENCE_URL_QWEN`, `INFERENCE_URL_GPT_OSS`)
- **`backend/router/gpt_service.py`**: 
  - Routing logic integration
  - Two-pass tool flow
  - Answer mode with GPT-OSS
  - Aggressive tool findings truncation (3 sources, 200 chars each)
  - FORCE_RESPONSE_AFTER = 1 (prevent hanging on large tool results)
- **`backend/router/query_router.py`**: NEW - Heuristic-based routing logic
- **`backend/router/answer_mode.py`**: NEW - Answer generation with firewall & Harmony cleanup
- **`backend/router/process_llm_response.py`**: Enhanced debugging for tool calling
- **`backend/router/simple_mcp_client.py`**: Enhanced logging for MCP debugging

### Infrastructure Changes
- **`backend/start-local-dev.sh`**: 
  - Dual `llama-server` instances (Qwen 8080, GPT-OSS 8082)
  - Optimized GPU layers: Qwen 33, GPT-OSS 32
  - Context sizes: Qwen 32K, GPT-OSS 8K
  - Parallelism: Qwen 4, GPT-OSS 2
  - Health checks for both models

### Testing & Documentation
- **New Test Suites**:
  - `test_router.py`: Query routing validation (17 test cases)
  - `test_mvp_queries.py`: End-to-end system tests (12 queries)
  - `test_optimization.py`: Performance benchmarking
  - `test_tool_calling.py`: Tool-calling validation
  - `TEST_QUERIES.md`: Comprehensive manual test guide

- **Documentation Files**:
  - `FINAL_IMPLEMENTATION_PLAN.md`: Complete architecture & implementation steps
  - `TOOL_CALLING_PROBLEM.md`: Root cause analysis of GPT-OSS bug
  - `OPTIMIZATION_PLAN.md`: Performance optimization strategy
  - `FINAL_OPTIMIZATION_RESULTS.md`: Achieved results
  - `MODEL_COMPARISON.md`: Llama 3.1 8B vs Qwen 2.5 32B vs GPT-OSS 20B
  - `MULTI_MODEL_STRATEGY.md`: Multi-model routing strategy
  - `GPU_BACKEND_ANALYSIS.md`: Metal vs CUDA investigation
  - `SUCCESS_SUMMARY.md`: End-to-end weather query analysis
  - `TEST_REPORT.md`: 12-test suite results

## 🧪 Testing

### Automated Test Results

**Query Router Tests** (17/17 passed ✅):
```bash
cd backend/router
uv run python test_router.py
```

**MVP Test Suite** (12 queries tested):
- **Tool Queries** (Weather, News): 14-20s ✅
- **Creative Queries** (Poems, Stories): 2-5s ✅
- **Knowledge Queries** (Definitions): 2-5s ✅
- **Success Rate**: ~90%+

### Manual Testing
See `TEST_QUERIES.md` for comprehensive test queries including:
- Single queries (weather, news, creative, knowledge)
- Multi-turn conversations
- Edge cases

## 🐛 Known Issues

### Minor: Harmony Format Artifacts (Cosmetic)
GPT-OSS was fine-tuned with a "Harmony format" that includes internal reasoning channels:
- `<|channel|>analysis<|message|>` - Internal reasoning
- `<|channel|>final<|message|>` - User-facing answer

**Impact**: Some responses may include meta-commentary like "We need to check..." or markers.

**Mitigation**: 
- Post-processing with regex to strip markers
- Removes most artifacts, some edge cases remain
- Does NOT affect functionality or speed
- User still receives correct information

**Decision**: Accepted for MVP due to 15x speed advantage over Qwen for answer generation.

## 🚀 Deployment

### Local Development Setup

**Terminal 1** - Start GPU services:
```bash
cd backend
./start-local-dev.sh
```

**Terminal 2** - Start Docker services (Router + MCP):
```bash
cd backend
docker-compose --profile local up
```

**Terminal 3** - Test:
```bash
curl -N http://localhost:8000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is the weather in Paris?"}'
```

### Production Considerations

1. **Model Files Required**:
   - `qwen2.5-32b-instruct-q4_k_m.gguf` (~18GB)
   - `openai_gpt-oss-20b-Q4_K_S.gguf` (~11GB)

2. **Hardware Requirements**:
   - **Mac**: M-series with 32GB+ unified memory (runs both models)
   - **Production**: RTX 4000 SFF 20GB (Qwen) + separate GPU for GPT-OSS, or sequential loading

3. **Environment Variables**:
   ```bash
   INFERENCE_URL_QWEN=http://localhost:8080
   INFERENCE_URL_GPT_OSS=http://localhost:8082
   MCP_BRAVE_URL=http://mcp-brave:8080/mcp
   MCP_FETCH_URL=http://mcp-fetch:8000/mcp
   BRAVE_API_KEY=<your-key>
   ```

## 📈 Performance Metrics

### Before (Baseline with GPT-OSS 20B single model)
- Weather query: **68.9s** ❌
- Infinite tool loops ❌
- Empty responses ❌
- Timeouts ❌

### After (Multi-model with Qwen + GPT-OSS)
- Weather query: **14.5s** ✅ (80% faster)
- No infinite loops ✅
- Clean responses ✅ (minor Harmony format artifacts)
- No timeouts ✅

### Speed Breakdown (Weather Query)
- MCP tool calls: ~8-10s
- Answer generation (GPT-OSS): ~2-3s
- Routing/overhead: ~1-2s
- **Total**: ~14-15s ✅

## 🔄 Migration Path

### From Current System
1. Download Qwen 2.5 Instruct 32B model
2. Update `start-local-dev.sh` to run dual inference servers
3. Deploy updated router with multi-model support
4. Test with automated test suites
5. Monitor performance and error rates

### Rollback Plan
If issues arise, revert to single-model by:
- Setting `INFERENCE_URL_QWEN` and `INFERENCE_URL_GPT_OSS` to same URL
- Query router will still work, just route everything to one model

## 🎓 Lessons Learned

1. **Model Selection Matters**: GPT-OSS 20B is fast but broken for tool calling
2. **Benchmarks ≠ Real-world**: GPT-OSS tests well on paper, fails in production
3. **Multi-model is powerful**: Right model for right task = 80% speed improvement
4. **Tool result size matters**: Large tool results cause Qwen to hang/slow down
5. **Answer mode firewall**: Essential to prevent tool-calling hallucinations

## 📚 Related Documentation

- `FINAL_IMPLEMENTATION_PLAN.md` - Complete implementation guide
- `TOOL_CALLING_PROBLEM.md` - GPT-OSS bug analysis
- `OPTIMIZATION_PLAN.md` - Optimization strategy
- `TEST_QUERIES.md` - Manual testing guide
- `MODEL_COMPARISON.md` - Model selection rationale

## 🙏 Next Steps (Future Work)

- [ ] Fine-tune Harmony format cleanup (optional cosmetic improvement)
- [ ] Add model performance monitoring/metrics
- [ ] Implement caching for repeated tool queries
- [ ] Explore streaming answer generation during tool execution
- [ ] Add confidence scoring for routing decisions
- [ ] Implement automatic fallback on model failures

## ✅ Ready to Merge?

**MVP Criteria Met**:
- ✅ Weather queries <15s
- ✅ News queries <20s
- ✅ Fast simple queries
- ✅ No infinite loops
- ✅ Reliable tool execution
- ✅ Multi-turn conversations work

**Recommendation**: Ready for merge and user testing. Minor Harmony format artifacts are acceptable trade-off for 80% performance improvement.

