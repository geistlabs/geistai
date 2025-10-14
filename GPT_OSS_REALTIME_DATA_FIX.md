# GPT-OSS Real-Time Data Fix - Work Log

## Problem Statement

**Core Issue:** GPT-OSS successfully calls brave-mcp-server tools (web_search, fetch) to get real-time data, but only returns planning steps instead of the actual data it fetched.

**Example:**

- User asks: "What's the weather in Paris?"
- GPT-OSS calls `brave_web_search` ✅
- GPT-OSS calls `fetch` on weather URLs ✅
- GPT-OSS response: "Let's search..." or "We need to fetch..." ❌
- Expected: Actual temperature and weather data

**Root Cause:** GPT-OSS 20B has a Harmony format behavior where it streams responses to `reasoning_content` instead of `content`, especially after tool calls.

---

## What Was Achieved Today

### 1. Identified Harmony Format Issue

- GPT-OSS streams to `reasoning_content` channel instead of `content`
- Non-streaming responses reject `reasoning_content`, causing "Empty content in response"
- Post-tool-call responses are reasoning-only, no actual data

### 2. Implemented Fixes

#### **File: `backend/router/gpt_service.py`**

- Added `_last_tool_results: List[dict] = []` to persist tool execution results
- Modified `process_chat_request()` to accept `reasoning_content` as fallback when `content` is empty
- Modified `_execute_tool()` to store tool results for post-processing
- Reset `_last_tool_results` at the start of each streaming request

#### **File: `backend/router/agent_tool.py`**

- Tightened `_is_reasoning_only()` detection (removed length gate, checks for citations/numbers)
- Improved `_generate_final_answer()` to extract from tool results instead of making second LLM call
- Added `brave_summarizer` to `research_agent` and `current_info_agent` tools
- Implemented fallback fetch to BBC/TimeandDate when initial fetches fail

#### **File: `backend/router/prompts.py`**

- Updated `get_research_agent_prompt()` to prefer BBC/TimeandDate, avoid AccuWeather
- Updated `get_current_info_agent_prompt()` to prefer BBC/TimeandDate, avoid AccuWeather
- Added explicit instructions to fetch from reliable sources

#### **File: `backend/router/config.py`**

**we have to verify this change because when we run the tests we couldn't verify if this modification helped with something**

- Increased `MAX_TOKENS` from 4096 to 16384 (reasoning_content counts toward token limit)

### 3. Source Discovery

- **AccuWeather**: Returns HTTP 503 from cluster (Akamai/CDN/anti-bot blocking)
- **BBC Weather**: Returns HTTP 200, fetchable ✅
- **TimeandDate**: Returns HTTP 200, fetchable ✅

### 4. Commit Made

```
commit 50761f4
Fix GPT-OSS Harmony format issue with tool result extraction
```

---

## Attempted Solutions (All Tried)

1. **Updated Prompts** → Failed (GPT-OSS still uses reasoning_content)
2. **Increased MAX_TOKENS** → Failed (not a token limit issue)
3. **Post-Processing Layer** → Partially working, but complex
4. **Source Fallbacks** → Working, but fragile

---

## Current State

### Test Results (Before Rollback)

From logs, we saw:

- ✅ Detection working: `⚠️  Agent current_info_agent returned reasoning-only response`
- ✅ Tool results extracted: `🔍 Found 3 tool results from GPT service`
- ✅ Fallback working: `✅ Built fallback answer from preferred source: https://www.timeanddate.com/weather/france/paris`
- ⚠️ **BUT**: Unknown if the final response reached the frontend correctly

### Unresolved Questions

1. **Did the response format work with the frontend?**

   - We didn't verify if the frontend can process the new response format
   - Might need frontend updates to handle the extracted tool data

2. **Is the solution over-engineered?**

   - Current approach adds complexity (post-processing, fallbacks, source preferences)
   - Might be simpler alternatives we haven't explored

3. **Performance?**
   - Didn't measure response time with all the post-processing layers
   - Unknown if it's acceptable for production

---

## Next Steps

### Immediate Actions

1. **Deploy new router image** with all fixes
2. **Run backend test** via curl to port-forwarded router
3. **Run frontend test** using the actual app
4. **Debug frontend response processing** to see what format it expects

### Testing Plan

```bash
# 1. Deploy router
kubectl set image deployment/geist-router -n development \
  router=alo42/router:development-1.0.33

# 2. Wait for rollout
kubectl rollout status deployment/geist-router -n development

# 3. Port-forward for testing
kubectl port-forward -n development deployment/geist-router 9003:8000

# 4. Test backend
curl -X POST http://localhost:9003/api/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the weather in Paris?"}' \
  --no-buffer

# 5. Check logs
kubectl logs -n development deployment/geist-router --tail=500 | \
  grep -E "reasoning-only|Built answer|Sources:"

# 6. Test frontend
# Open GeistAI app, ask "What's the weather in Paris?"
# Debug what response format the frontend receives
```

### Investigation Areas

1. **Frontend Response Format**

   - What does the frontend expect from `/api/stream`?
   - Can it handle tool-extracted data vs reasoning content?
   - Does it need updates to process new response structure?

2. **Alternative Solutions**

   - Should we use a different model for real-time queries?
   - Can we restructure tool result feedback to GPT-OSS?
   - Is there a simpler prompt engineering approach?

3. **Simplification Opportunities**
   - Can we remove some of the post-processing layers?
   - Is the fallback fetch really needed or over-kill?
   - Can we trust GPT-OSS to use data with better prompts?

---

## Files Modified

### Backend Changes

- `backend/router/gpt_service.py` - Harmony fallback + tool persistence
- `backend/router/agent_tool.py` - Detection + finalizer + brave_summarizer
- `backend/router/prompts.py` - Source preferences
- `backend/router/config.py` - MAX_TOKENS increase

### Not Modified (May Need Updates)

- `frontend/` - Unknown if it can handle new response format
- Frontend response processing logic
- Frontend SSE/streaming handlers

---

## Notes & Observations

### What Works

- Tool calling is reliable (brave_web_search, fetch)
- Detection of reasoning-only responses
- Tool result extraction from GPT service
- Fallback to reliable sources (BBC, TimeandDate)

### What's Unclear

- Final response format reaching the frontend
- Whether frontend needs updates
- If the complexity is justified
- Production performance impact

### What Doesn't Work

- AccuWeather (503 blocking)
- Weather.com (likely also blocked)
- Relying on GPT-OSS alone without post-processing

---

## Local Development Consideration

**Issue with Current Local Setup:**
Running LLM models locally (GPT-OSS 20B, Qwen, etc.) during development is resource-intensive and slow:

- High RAM usage (20GB+ for GPT-OSS)
- High CPU usage (600%+)
- Slower iteration cycles
- Inconsistent with production environment

**Proposed Solution:**
Instead of hosting models locally, connect to deployed development/production instances:

- Point `INFERENCE_URL` to development cluster inference service
- Use `kubectl port-forward` to access cluster services
- Faster development cycles
- Consistent behavior with production
- Lower local resource requirements

**Example Configuration:**

```bash
# Instead of running llama-server locally
# INFERENCE_URL=http://localhost:8080

# Use development cluster
kubectl port-forward -n development svc/geist-inference 8080:8080
INFERENCE_URL=http://localhost:8080
```

This allows frontend/router development without running heavy models locally.

---

## Summary for Colleagues

Today I worked on fixing how GPT-OSS handles real-time data queries through brave-mcp-server. The main issue is that while GPT-OSS successfully calls the right tools (web_search, fetch) to get current data, it only returns planning steps ("Let's search...") instead of the actual data it fetched. I tried several approaches - updated prompts, increased tokens, added post-processing, and source fallbacks - but none fully solved the issue. I still need to find a way to make GPT-OSS actually use the data it fetches, rather than just planning to use it.

The next step is to deploy the latest changes, test both backend and frontend, and determine if the response format works end-to-end or if frontend updates are needed.
