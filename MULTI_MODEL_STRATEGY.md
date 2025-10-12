# Multi-Model Strategy - Best of All Worlds

## Overview: Intelligent Model Routing

**Core Idea**: Host multiple specialized models and route queries to the best model for each task.

```
User Query
    ↓
Intelligent Router (classifies query type)
    ↓
    ├─→ Simple/Creative → Small Fast Model (Llama 3.1 8B)
    │                     "Write a poem", "Explain X"
    │                     1-3 seconds, 95% of quality needed
    │
    ├─→ Tool Calling → Medium Model (Qwen 2.5 32B)
    │                  "Weather in Paris", "Latest news"
    │                  8-15 seconds, excellent tool support
    │
    ├─→ Complex/Research → Large Model (Llama 3.3 70B)
    │                       "Analyze this...", "Compare..."
    │                       15-30 seconds, maximum quality
    │
    └─→ Fallback → External API (Claude/GPT-4)
                   Only if local models fail
                   Cost: pennies per query
```

---

## Strategy 1: Two-Model System ⭐ **RECOMMENDED FOR MVP**

### Models:

1. **Qwen 2.5 Coder 32B** - Tool calling (main workhorse)
2. **Llama 3.1 8B** - Fast responses for simple queries

### Why This Works:

**Memory Usage:**

- Qwen 32B: ~18GB (Q4_K_M)
- Llama 8B: ~5GB (Q4_K_M)
- **Total: ~23GB** ✅ Fits easily on M3 Pro (36GB RAM)

**Performance:**

```
Query Type          Model Used      Response Time    Quality
────────────────────────────────────────────────────────────
"Write a haiku"     Llama 8B        1-2 seconds      ★★★★☆
"What's 2+2?"       Llama 8B        <1 second        ★★★★★
"Explain Docker"    Llama 8B        2-3 seconds      ★★★★☆
"Weather Paris"     Qwen 32B        8-12 seconds     ★★★★★
"Today's news"      Qwen 32B        10-15 seconds    ★★★★★
"Complex analysis"  Qwen 32B        15-25 seconds    ★★★★☆
```

### Implementation:

```python
# In backend/router/model_router.py (NEW FILE)

class ModelRouter:
    """Route queries to the best model"""

    def __init__(self):
        self.fast_model = "http://localhost:8081"  # Llama 8B
        self.tool_model = "http://localhost:8080"  # Qwen 32B
        self.claude_fallback = ClaudeClient()  # Emergency only

    def classify_query(self, query: str) -> str:
        """Determine which model to use"""
        query_lower = query.lower()

        # Check if tools are needed
        tool_keywords = [
            "weather", "temperature", "forecast",
            "news", "today", "latest", "current", "now",
            "search", "find", "lookup", "what's happening"
        ]

        if any(kw in query_lower for kw in tool_keywords):
            return "tool_model"

        # Check if it's a simple query
        simple_patterns = [
            "write a", "create a", "generate",
            "what is", "define", "explain",
            "calculate", "solve", "what's",
            "tell me about", "how does"
        ]

        if any(pattern in query_lower for pattern in simple_patterns):
            return "fast_model"

        # Default to tool model (more capable)
        return "tool_model"

    async def route_query(self, query: str, messages: list):
        """Route query to appropriate model"""
        model_choice = self.classify_query(query)

        print(f"📍 Routing to: {model_choice} for query: {query[:50]}...")

        try:
            if model_choice == "fast_model":
                return await self.query_fast_model(messages)
            else:
                return await self.query_tool_model(messages)

        except Exception as e:
            print(f"❌ Local model failed: {e}")
            print(f"🔄 Falling back to Claude API")
            return await self.claude_fallback.query(messages)
```

### Setup:

**1. Download both models:**

```bash
cd /Users/alexmartinez/openq-ws/geistai/backend/inference/models

# Qwen 32B for tool calling
wget https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct-GGUF/resolve/main/qwen2.5-coder-32b-instruct-q4_k_m.gguf

# Llama 8B for fast responses
wget https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf
```

**2. Start both models in parallel:**

Create `start-multi-model.sh`:

```bash
#!/bin/bash

# Start Llama 8B on port 8081 (fast model)
echo "🚀 Starting Llama 8B (Fast Model) on port 8081..."
./llama.cpp/build/bin/llama-server \
    -m ./inference/models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
    --host 0.0.0.0 \
    --port 8081 \
    --ctx-size 8192 \
    --n-gpu-layers 32 \
    --parallel 2 \
    --cont-batching \
    > /tmp/geist-fast-model.log 2>&1 &

sleep 5

# Start Qwen 32B on port 8080 (tool model)
echo "🧠 Starting Qwen 32B (Tool Model) on port 8080..."
./llama.cpp/build/bin/llama-server \
    -m ./inference/models/qwen2.5-coder-32b-instruct-q4_k_m.gguf \
    --host 0.0.0.0 \
    --port 8080 \
    --ctx-size 32768 \
    --n-gpu-layers 33 \
    --parallel 4 \
    --cont-batching \
    --jinja \
    > /tmp/geist-tool-model.log 2>&1 &

echo "✅ Both models started!"
echo "   Fast Model (Llama 8B): http://localhost:8081"
echo "   Tool Model (Qwen 32B): http://localhost:8080"
```

**3. Test routing:**

```bash
# Fast query (should use Llama 8B)
curl http://localhost:8000/api/chat/stream \
  -d '{"message": "Write a haiku about coding"}'

# Tool query (should use Qwen 32B)
curl http://localhost:8000/api/chat/stream \
  -d '{"message": "What is the weather in Paris?"}'
```

---

## Strategy 2: Three-Model System (Maximum Performance)

### Models:

1. **Llama 3.1 8B** - Ultra-fast simple queries (5GB)
2. **Qwen 2.5 32B** - Tool calling specialist (18GB)
3. **Llama 3.3 70B** - Complex reasoning (40GB)

**Total: ~63GB** - Needs production server, won't fit on Mac for dev

### When to Use Each:

```python
def classify_query_advanced(self, query: str, context_length: int) -> str:
    """Advanced classification with 3 models"""

    # Ultra-fast for simple, short queries
    if context_length < 100 and self.is_simple_query(query):
        return "llama_8b"  # 1-2 seconds

    # Tool calling
    elif self.needs_tools(query):
        return "qwen_32b"  # 8-15 seconds

    # Complex reasoning, long context, analysis
    elif context_length > 2000 or self.is_complex(query):
        return "llama_70b"  # 20-40 seconds

    # Default: Qwen 32B (good balance)
    else:
        return "qwen_32b"
```

### Complex Query Detection:

```python
def is_complex(self, query: str) -> bool:
    """Detect if query needs large model"""
    complex_indicators = [
        "analyze", "compare", "contrast", "evaluate",
        "research", "comprehensive", "detailed analysis",
        "pros and cons", "advantages disadvantages",
        "step by step", "walkthrough", "tutorial",
        len(query) > 200  # Long queries = complex needs
    ]
    return any(ind in query.lower() for ind in complex_indicators)
```

---

## Strategy 3: Specialized Models by Domain

### Models:

1. **Qwen 2.5 Coder 32B** - Code, technical questions
2. **Llama 3.1 70B** - General knowledge, reasoning
3. **Mistral 7B** - Fast creative writing
4. **DeepSeek Coder 33B** - Advanced coding

**This is overkill for MVP** but shows what's possible.

---

## Strategy 4: Dynamic Model Loading (Advanced)

**Load models on-demand to save memory:**

```python
class DynamicModelManager:
    """Load/unload models based on usage"""

    def __init__(self):
        self.loaded_models = {}
        self.usage_stats = {}

    async def get_model(self, model_name: str):
        """Load model if not in memory"""
        if model_name not in self.loaded_models:
            print(f"📥 Loading {model_name}...")
            self.loaded_models[model_name] = await self.load_model(model_name)

        self.usage_stats[model_name] = time.time()
        return self.loaded_models[model_name]

    async def unload_least_used(self):
        """Free memory by unloading unused models"""
        if len(self.loaded_models) > 2:  # Keep max 2 models
            least_used = min(self.usage_stats, key=self.usage_stats.get)
            print(f"💾 Unloading {least_used} to free memory...")
            del self.loaded_models[least_used]
```

**Pros:**

- Can have 5+ models available
- Only 2 loaded at a time
- Adapts to usage patterns

**Cons:**

- Model loading takes 10-30 seconds
- Complex to implement
- Better for production than MVP

---

## Recommended Implementation Path

### Phase 1: Two-Model MVP (Week 1)

**Goal**: Get tool calling working with fast fallback

1. **Download both models** (2 hours)

   - Qwen 32B for tools
   - Llama 8B for speed

2. **Implement basic routing** (4 hours)

   - Query classifier
   - Simple keyword matching
   - Route to appropriate model

3. **Test thoroughly** (4 hours)
   - Weather queries → Qwen
   - Creative queries → Llama 8B
   - Validate performance

**Expected Results:**

- 70% queries use Llama 8B (1-3 sec)
- 30% queries use Qwen 32B (8-15 sec)
- Average response time: <5 seconds

### Phase 2: Optimize Routing (Week 2)

**Goal**: Improve classification accuracy

1. **Add ML-based classifier** (optional)

   ```python
   from sentence_transformers import SentenceTransformer

   class SmartRouter:
       def __init__(self):
           self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
           self.tool_queries = [
               "what's the weather like",
               "latest news about",
               "current temperature in"
           ]

       def classify(self, query: str):
           query_emb = self.embedder.encode(query)
           # Find most similar example
           # Route accordingly
   ```

2. **Track routing accuracy**
   - Log when routing seems wrong
   - Adjust keywords based on usage
   - A/B test different strategies

### Phase 3: Add Third Model (Optional, Week 3-4)

**If needed for complex queries:**

1. **Add Llama 3.3 70B** for research/analysis
2. **Only load on production server** (not on Mac)
3. **Route <5% of queries** to it

---

## Cost & Performance Comparison

### Two-Model System (Recommended):

| Metric       | Value               |
| ------------ | ------------------- |
| Models       | Llama 8B + Qwen 32B |
| Memory       | 23GB total          |
| Avg Response | 4-6 seconds         |
| Quality      | ★★★★☆ (excellent)   |
| Cost         | $0/month            |
| Complexity   | Low                 |
| Setup Time   | 1 day               |

### Three-Model System:

| Metric       | Value                           |
| ------------ | ------------------------------- |
| Models       | Llama 8B + Qwen 32B + Llama 70B |
| Memory       | 63GB total                      |
| Avg Response | 3-5 seconds                     |
| Quality      | ★★★★★ (best)                    |
| Cost         | $0/month                        |
| Complexity   | Medium                          |
| Setup Time   | 2-3 days                        |

### Single Model (Current):

| Metric       | Value                |
| ------------ | -------------------- |
| Models       | GPT-OSS 20B (broken) |
| Memory       | 12GB                 |
| Avg Response | Timeout              |
| Quality      | ★☆☆☆☆ (broken)       |
| Cost         | $0/month             |
| Complexity   | Low                  |
| Setup Time   | Done (but broken)    |

---

## Hardware Requirements

### Your M3 Pro Mac (Local Dev):

**Option A: Two models** ✅ RECOMMENDED

- Llama 8B (5GB) + Qwen 32B (18GB) = 23GB
- Leaves 13GB for system
- Both models in memory simultaneously
- Fast switching

**Option B: Single model**

- Just Qwen 32B (18GB)
- Leaves 18GB for system
- No fast fallback
- Simpler setup

### Production Server:

**If you have 40GB+ VRAM:**

- Run all 3 models simultaneously
- Llama 8B + Qwen 32B + Llama 70B
- Optimal performance

**If you have 24GB VRAM:**

- Run 2 models: Llama 8B + Qwen 32B
- Load Llama 70B on-demand if needed

---

## External API as Last Resort

**Only use when:**

1. All local models fail (error/timeout)
2. Query explicitly asks for "GPT-4" or "Claude"
3. Load testing shows local can't handle volume

### Fallback Implementation:

```python
class SmartRouter:
    def __init__(self):
        self.local_models = [...]
        self.claude = ClaudeClient(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.fallback_count = 0
        self.fallback_limit = 100  # Max 100 API calls per day

    async def route_query(self, query, messages):
        """Try local first, API as last resort"""

        # Try local models
        for model in self.local_models:
            try:
                return await model.query(messages)
            except Exception as e:
                print(f"❌ {model.name} failed: {e}")
                continue

        # All local models failed - use API
        if self.fallback_count < self.fallback_limit:
            print(f"🌐 Using Claude API (fallback #{self.fallback_count})")
            self.fallback_count += 1
            return await self.claude.query(messages)

        # Even fallback exhausted
        return {"error": "All models unavailable"}
```

**Expected fallback rate**: <1% of queries (if local models are healthy)

---

## My Recommendation: Start Simple, Scale Up

### Week 1: Two-Model MVP

1. Download Qwen 32B + Llama 8B
2. Implement basic routing (keyword-based)
3. Test thoroughly
4. Deploy to production

**This gives you**:

- Fast responses (1-3 sec for 70% of queries)
- Working tool calling (8-15 sec for 30%)
- No API costs
- Low complexity

### Week 2-3: Optimize

- Track which queries are slow
- Improve routing logic
- Add monitoring/metrics
- Fine-tune prompts

### Week 4+: Scale if Needed

- Add Llama 70B if complex queries are slow
- Consider API fallback if reliability issues
- Add caching for common queries

---

## Next Steps - Let's Get Started

**Answer these questions:**

1. **Which strategy appeals to you?**

   - A) Two-model (Llama 8B + Qwen 32B) - Recommended
   - B) Single model (just Qwen 32B) - Simpler
   - C) Three-model (add Llama 70B) - Maximum quality

2. **Do you want to implement routing now?**

   - Or start with single model first, add routing later?

3. **Should I help you download and set up?**
   - I can provide exact commands for your Mac

**My suggestion**: Start with **Option A (Two-Model)** - gives you best ROI:

- Fast and capable
- Fits on your Mac
- 1-day implementation
- Easy to add third model later if needed

Ready to start downloading? 🚀
