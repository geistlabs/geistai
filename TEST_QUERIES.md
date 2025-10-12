# 🧪 Test Queries for GeistAI

## 🔧 Tool-Calling Queries (Routes to Qwen)
These should use `brave_web_search` and/or `fetch`, then generate an answer.
**Expected time: 10-20 seconds**

### Weather Queries
```bash
# Simple weather
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the weather in Paris?"}]}'

# Specific location
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the temperature in Tokyo right now?"}]}'

# Multi-day forecast
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the weather forecast for London this week?"}]}'
```

### News Queries
```bash
# Current events
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What are the latest AI news today?"}]}'

# Tech news
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What happened in tech news this week?"}]}'

# Sports
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Latest NBA scores today"}]}'
```

### Search Queries
```bash
# Current information
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Who won the 2024 Nobel Prize in Physics?"}]}'

# Factual lookup
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the current price of Bitcoin?"}]}'
```

---

## 📝 Creative Queries (Routes to GPT-OSS)
These should bypass tools and use GPT-OSS directly.
**Expected time: 2-5 seconds**

```bash
# Poem
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Write a haiku about coding"}]}'

# Story
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Tell me a short story about a robot"}]}'

# Joke
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Tell me a programming joke"}]}'
```

---

## 🤔 Simple Knowledge Queries (Routes to GPT-OSS)
General knowledge that doesn't need current information.
**Expected time: 2-5 seconds**

```bash
# Definition
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is Docker?"}]}'

# Explanation
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Explain how HTTP works"}]}'

# Concept
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is machine learning?"}]}'
```

---

## 💬 Multi-Turn Conversations

### Conversation 1: Weather Follow-up
```bash
# Turn 1
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is the weather in Paris?"}
    ]
  }'

# Turn 2 (after getting response)
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is the weather in Paris?"},
      {"role":"assistant","content":"The weather in Paris today is 12°C with partly cloudy skies..."},
      {"role":"user","content":"How about London?"}
    ]
  }'

# Turn 3
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is the weather in Paris?"},
      {"role":"assistant","content":"The weather in Paris today is 12°C..."},
      {"role":"user","content":"How about London?"},
      {"role":"assistant","content":"London is currently 10°C with light rain..."},
      {"role":"user","content":"Which city is warmer?"}
    ]
  }'
```

### Conversation 2: News + Creative
```bash
# Turn 1: Tool query
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What are the latest AI developments?"}
    ]
  }'

# Turn 2: Creative follow-up (should route to GPT-OSS)
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What are the latest AI developments?"},
      {"role":"assistant","content":"Recent AI developments include..."},
      {"role":"user","content":"Write a poem about these AI advances"}
    ]
  }'
```

### Conversation 3: Mixed Context
```bash
# Turn 1: Simple question (GPT-OSS)
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is Python?"}
    ]
  }'

# Turn 2: Current info (Qwen + tools)
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is Python?"},
      {"role":"assistant","content":"Python is a high-level programming language..."},
      {"role":"user","content":"What is the latest Python version released?"}
    ]
  }'

# Turn 3: Code request (Qwen direct)
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages":[
      {"role":"user","content":"What is Python?"},
      {"role":"assistant","content":"Python is a high-level programming language..."},
      {"role":"user","content":"What is the latest Python version released?"},
      {"role":"assistant","content":"Python 3.12 was released in October 2023..."},
      {"role":"user","content":"Write me a hello world in Python"}
    ]
  }'
```

---

## 🎯 Edge Cases to Test

### Complex Multi-Step Query
```bash
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Compare the weather in Paris, London, and New York"}]}'
```

### Ambiguous Query (Tests Routing)
```bash
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Tell me about the latest in Paris"}]}'
```

### Long Context
```bash
curl -N http://localhost:8000/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the weather in Paris? Also, can you explain what causes weather patterns? And then tell me a joke about the weather?"}]}'
```

---

## 📊 What to Look For

### Router Logs (Terminal 2)
```
🎯 Query routed to: qwen_tools     # Tool-calling query
🎯 Query routed to: gpt_oss        # Creative/simple query
🎯 Query routed to: qwen_direct    # Complex but no tools
```

### GPU Logs (Terminal 1)
```
📍 Request to Qwen (port 8080)
📍 Request to GPT-OSS (port 8082)
```

### Response Quality
- **Speed**: Tool queries ~10-20s, simple queries ~2-5s
- **Content**: Check for Harmony markers (`<|channel|>`, `We need to check...`)
- **Sources**: Tool queries should include source URLs
- **Accuracy**: Responses should match the query intent

---

## 🐛 Known Issues

1. **Harmony Format Artifacts** (Minor):
   - GPT-OSS may include meta-commentary like "We need to check..."
   - Responses may have `<|channel|>analysis` markers
   - Post-processing attempts to clean these up

2. **Tool Result Size**:
   - Findings truncated to 200 chars per source (max 3 sources)
   - This is intentional for speed

3. **First Query Slow**:
   - First inference request may be slower (model warmup)
   - Subsequent queries should be faster

---

## 🚀 Quick Test Script

Save this as `quick_test.sh`:

```bash
#!/bin/bash

echo "🧪 Quick GeistAI Test Suite"
echo ""

test_query() {
  local name=$1
  local query=$2
  echo "Testing: $name"
  echo "Query: $query"
  time curl -N http://localhost:8000/v1/chat/stream \
    -H 'Content-Type: application/json' \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$query\"}]}" 2>&1 | head -20
  echo ""
  echo "---"
  sleep 2
}

test_query "Weather" "What is the weather in Paris?"
test_query "Creative" "Write a haiku about AI"
test_query "Knowledge" "What is Docker?"
test_query "News" "Latest AI news"

echo "✅ Test suite complete!"
```

Run with: `chmod +x quick_test.sh && ./quick_test.sh`
