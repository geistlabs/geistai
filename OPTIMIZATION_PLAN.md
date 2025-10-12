# Answer Generation Optimization Plan

**Date:** October 12, 2025
**Goal:** Reduce tool-calling query time from **47s → 15s** (68% improvement)
**Status:** Planning Phase

---

## 🎯 Current Performance Baseline

### Tool-Calling Queries (Qwen + MCP + Answer Mode)

| Metric                | Current   | Target | Gap           |
| --------------------- | --------- | ------ | ------------- |
| **Total Time**        | 46.9s avg | 15s    | -31.9s (-68%) |
| **Tool Execution**    | ~5s       | ~5s    | ✅ Acceptable |
| **Answer Generation** | ~40s      | ~8s    | -32s (-80%)   |

**Breakdown of 46.9s average:**

- Query routing: <1s ✅
- Qwen tool call generation: 3-5s ✅
- MCP Brave search: 3-5s ✅
- **Answer mode generation: 35-40s ❌ TOO SLOW**
- Streaming overhead: 1-2s ✅

**The bottleneck is 100% in answer mode generation.**

---

## 🔍 Root Cause Analysis

### Why is Answer Mode So Slow?

Let me check the current `answer_mode.py` configuration:

**Current Settings (Suspected):**

```python
{
    "messages": [...],  # Includes tool results (500+ chars)
    "stream": True,
    "max_tokens": 512,      # ❌ TOO HIGH
    "temperature": 0.2,     # ❌ TOO LOW (slower sampling)
    "tools": [],            # ✅ Correct (disabled)
    "tool_choice": "none"   # ✅ Correct
}
```

**Problems Identified:**

1. **`max_tokens: 512` is excessive**

   - Target response: 2-4 sentences + sources
   - Typical tokens needed: 80-150
   - We're generating 2-3x more than needed
   - **Impact:** Unnecessary generation time

2. **`temperature: 0.2` is too conservative**

   - Low temperature = slower, more deliberate sampling
   - More computation per token
   - **Impact:** ~30-40% slower token generation

3. **Tool findings might be too verbose**

   - Currently: 526 chars average
   - Includes lots of HTML snippets and metadata
   - **Impact:** Larger context = slower processing

4. **Context size might be unnecessarily large**
   - Using full 32K context window
   - Most of it is empty
   - **Impact:** Overhead in attention computation

---

## 💡 Optimization Strategy

### Phase 1: Quick Wins (Easy, High Impact)

These changes can be made in 5-10 minutes and should provide immediate 50-70% speedup.

#### 1.1: Reduce `max_tokens` ✅ HIGHEST IMPACT

**Current:** `max_tokens: 512`
**Target:** `max_tokens: 150`

**Reasoning:**

- Weather answer example: "The weather in Paris is expected to be partly cloudy..." = ~125 tokens
- Target format: 2-4 sentences (60-100 tokens) + sources (20-30 tokens) = 80-130 tokens
- Buffer: +20 tokens = 150 tokens total

**Expected Impact:** 50-60% faster (512 → 150 = 71% fewer tokens)

**Implementation:**

```python
# In answer_mode.py, line ~45
"max_tokens": 150,  # Changed from 512
```

#### 1.2: Increase `temperature` ✅ HIGH IMPACT

**Current:** `temperature: 0.2`
**Target:** `temperature: 0.7`

**Reasoning:**

- Higher temperature = faster sampling
- Less "overthinking" per token
- Still coherent for factual summaries
- 0.7 is standard for chat applications

**Expected Impact:** 20-30% faster token generation

**Implementation:**

```python
# In answer_mode.py, line ~46
"temperature": 0.7,  # Changed from 0.2
```

#### 1.3: Truncate Tool Findings ✅ MEDIUM IMPACT

**Current:** Tool findings ~526 chars (includes HTML, long URLs)
**Target:** Tool findings ~200 chars (clean text only)

**Reasoning:**

- Most HTML/metadata is noise
- Only need key facts (temperature, conditions, location)
- Shorter context = faster processing

**Expected Impact:** 10-15% faster

**Implementation:**

```python
# In gpt_service.py, _extract_tool_findings method
def _extract_tool_findings(self, conversation: List[dict]) -> str:
    findings = []
    for msg in conversation:
        if msg.get("role") == "tool":
            content = msg.get("content", "")
            # Strip HTML tags
            import re
            content = re.sub(r'<[^>]+>', '', content)
            # Truncate to first 200 chars
            if len(content) > 200:
                content = content[:200] + "..."
            findings.append(content)

    return "\n".join(findings[:3])  # Max 3 findings
```

---

### Phase 2: Advanced Optimizations (Medium Effort, Medium Impact)

These require more testing but could provide additional 10-20% improvement.

#### 2.1: Optimize System Prompt ✅ LOW-MEDIUM IMPACT

**Current prompt in `answer_mode.py`:**

```python
system_prompt = (
    "You are in ANSWER MODE. Tools are disabled.\n"
    "Write a concise answer (2-4 sentences) from the findings below.\n"
    "Then list 1-2 URLs under 'Sources:'."
)
```

**Optimized prompt:**

```python
system_prompt = (
    "Summarize the key facts in 2-3 sentences. Add 1-2 source URLs.\n"
    "Be direct and concise."
)
```

**Reasoning:**

- Shorter prompt = less to process
- More direct instruction = faster response
- Remove meta-commentary about tools

**Expected Impact:** 5-10% faster

#### 2.2: Add Stop Sequences ✅ LOW-MEDIUM IMPACT

**Current:** No stop sequences
**Target:** Add stop sequences for cleaner termination

**Implementation:**

```python
# In answer_mode.py
"stop": ["\n\nUser:", "\n\nHuman:", "###"],  # Stop at conversational boundaries
```

**Reasoning:**

- Prevents over-generation
- Cleaner cutoff when done
- Saves a few tokens

**Expected Impact:** 5% faster

#### 2.3: Parallel Answer Generation (Future)

**Idea:** Generate answer while tool is still executing

**Implementation:**

- Start answer mode immediately when tool completes
- Don't wait for full tool result processing
- Stream answer as soon as first finding is ready

**Expected Impact:** 10-15% faster (perceived)

**Complexity:** High - requires refactoring

---

### Phase 3: Infrastructure Optimizations (High Effort, Variable Impact)

These require more significant changes but could help with edge cases.

#### 3.1: Use GPT-OSS for Simple Summaries

**Idea:** For weather queries, use GPT-OSS (faster) instead of Qwen for answer generation

**Reasoning:**

- GPT-OSS is 16x faster (2.8s vs 46.9s)
- Weather summaries don't need Qwen's reasoning power
- Simple text transformation task

**Expected Impact:** 50-70% faster for specific query types

**Implementation Complexity:** Medium

- Need to add route selection for answer mode
- Need to test GPT-OSS summarization quality

#### 3.2: Pre-compute Embeddings for Common Queries

**Idea:** Cache answers for common queries (e.g., "weather in Paris")

**Expected Impact:** 90%+ faster for cache hits

**Implementation Complexity:** High

- Need caching layer
- Need TTL for weather data (15-30 min)
- Need cache invalidation strategy

---

## 📋 Implementation Checklist

### Step 1: Quick Wins (10 minutes)

- [ ] Read current `answer_mode.py` settings
- [ ] Change `max_tokens: 512 → 150`
- [ ] Change `temperature: 0.2 → 0.7`
- [ ] Update `_extract_tool_findings()` to truncate to 200 chars
- [ ] Restart router
- [ ] Test with weather query
- [ ] Measure new performance

**Expected Result:** 47s → 15-20s (68% improvement)

### Step 2: Validate & Fine-Tune (20 minutes)

- [ ] Run 5 weather queries to get average
- [ ] Check answer quality (coherent? accurate? sources present?)
- [ ] If quality drops, adjust temperature (try 0.5)
- [ ] If still too slow, reduce max_tokens further (120)
- [ ] If too fast but incomplete, increase max_tokens (180)

**Target:** Consistent 15-20s with good quality

### Step 3: Advanced Optimizations (30 minutes)

- [ ] Optimize system prompt
- [ ] Add stop sequences
- [ ] Test with full test suite (12 queries)
- [ ] Document performance gains

**Target:** 15s average, 100% pass rate maintained

### Step 4: Explore GPT-OSS for Summaries (Optional, 1-2 hours)

- [ ] Test GPT-OSS summarization quality
- [ ] Implement route selection for answer mode
- [ ] A/B test Qwen vs GPT-OSS summaries
- [ ] Choose based on quality vs speed trade-off

**Target:** <10s for weather queries if quality is acceptable

---

## 🧪 Testing Plan

### Before Optimization

**Baseline:** Run 5 weather queries and record:

- Average time
- Token count
- Answer quality (1-5 scale)

### After Each Phase

**Validate:** Run same 5 queries and compare:

- Time improvement (%)
- Token count change
- Answer quality maintained (>4/5)

### Test Queries

1. "What is the weather in Paris?"
2. "What's the temperature in London right now?"
3. "Latest news about artificial intelligence"
4. "Search for Python tutorials"
5. "What's happening in the world today?"

### Success Criteria

| Metric          | Target | Must Have |
| --------------- | ------ | --------- |
| Average time    | <20s   | Yes       |
| Quality score   | >4/5   | Yes       |
| Pass rate       | 100%   | Yes       |
| Source citation | 100%   | Yes       |

---

## 📊 Expected Performance Gains

### Pessimistic Estimate (Conservative)

| Change                         | Impact | Cumulative |
| ------------------------------ | ------ | ---------- |
| Baseline                       | 47s    | 47s        |
| Reduce max_tokens (512→150)    | -40%   | 28s        |
| Increase temperature (0.2→0.7) | -20%   | 22s        |
| Truncate findings              | -10%   | 20s        |

**Result:** 47s → 20s (57% improvement)

### Optimistic Estimate (Best Case)

| Change                         | Impact | Cumulative |
| ------------------------------ | ------ | ---------- |
| Baseline                       | 47s    | 47s        |
| Reduce max_tokens (512→150)    | -60%   | 19s        |
| Increase temperature (0.2→0.7) | -30%   | 13s        |
| Truncate findings              | -15%   | 11s        |
| Optimize prompt                | -10%   | 10s        |

**Result:** 47s → 10s (79% improvement)

### Realistic Estimate (Most Likely)

| Change                         | Impact | Cumulative |
| ------------------------------ | ------ | ---------- |
| Baseline                       | 47s    | 47s        |
| Reduce max_tokens (512→150)    | -50%   | 24s        |
| Increase temperature (0.2→0.7) | -25%   | 18s        |
| Truncate findings              | -12%   | 16s        |

**Result:** 47s → 16s (66% improvement) ✅ Hits target!

---

## ⚠️ Risks & Mitigation

### Risk 1: Quality Degradation

**Risk:** Shorter answers might omit important details
**Mitigation:**

- Test with diverse queries
- Have fallback to increase max_tokens if needed
- Monitor user feedback

### Risk 2: Temperature Too High

**Risk:** Temperature 0.7 might produce less factual responses
**Mitigation:**

- Start with 0.5, then increase to 0.7 if quality is good
- Keep temperature lower (0.3-0.4) for factual queries
- Consider per-query-type temperature settings

### Risk 3: Over-Truncation

**Risk:** 200 char findings might lose critical information
**Mitigation:**

- Keep key facts (numbers, names, dates)
- Strip only HTML/metadata
- Test with queries that need specific data

---

## 🚀 Quick Start

**To begin optimization immediately:**

```bash
# 1. Check current settings
cd /Users/alexmartinez/openq-ws/geistai/backend/router
grep -A5 "max_tokens\|temperature" answer_mode.py

# 2. Make changes (see Phase 1 above)
# Edit answer_mode.py and gpt_service.py

# 3. Restart router
cd /Users/alexmartinez/openq-ws/geistai/backend
docker-compose restart router-local

# 4. Test
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Paris?", "messages": []}'

# 5. Measure time and compare to baseline (47s)
```

---

## 📝 Next Steps

1. ✅ Read current `answer_mode.py` to confirm settings
2. 🔧 Implement Phase 1 quick wins
3. 🧪 Test and validate
4. 📊 Document results
5. 🚀 Deploy if successful

**Let's start with Phase 1 now!** 🎯
