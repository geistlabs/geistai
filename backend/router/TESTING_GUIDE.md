# Router Testing Guide

This guide explains how to test the Geist AI Router system, including the streaming chat functionality, conversation evaluation, and database integration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Starting the System](#starting-the-system)
3. [Running Tests](#running-tests)
4. [Test Types](#test-types)
5. [Understanding Test Results](#understanding-test-results)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Testing](#advanced-testing)

## Prerequisites

Before running tests, ensure you have:

1. **Router Service Running**: The main router service must be running on `http://localhost:8000`
2. **Database Setup**: PostgreSQL database with proper migrations applied
3. **Dependencies Installed**: All Python dependencies from `pyproject.toml`
4. **Environment Variables**: Proper configuration in your environment

### Quick Setup Check

```bash
# Check if router is running
curl http://localhost:8000/health

# Check database connection
python -c "from database import get_db_session; print('Database OK')"

# Check dependencies
pip list | grep -E "(httpx|fastapi|sqlalchemy)"
```

## Starting the System

### 1. Start the Router Service

```bash
# From the backend/router directory
cd backend/router

# Activate virtual environment (if using one)
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows Command Prompt
# or
venv\Scripts\Activate.ps1 # Windows PowerShell

# Start the router service
python main.py
```

The service should start on `http://localhost:8000` with output like:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Verify Service Health

```bash
# Test basic connectivity
curl http://localhost:8000/health

# Test chat endpoint availability
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, are you working?"}'
```

## Running Tests

### Basic Conversation Test

The main test script is `test_conversation.py` which tests streaming chat functionality:

```bash
# Run a single conversation test
python test_conversation.py
```

This will:
- Test streaming chat responses
- Evaluate response quality using the reasonableness service
- Store results in the database
- Provide detailed analysis and metrics

### Parallel Testing

The script automatically runs multiple conversations in parallel for efficiency:

```python
# The test_parallel_conversation() function runs all conversations from short_conversations
# Each conversation is tested independently and concurrently
```

### Custom Test Cases

You can modify test cases in `initial_test_cases.py`:

```python
# Add your own test conversations
custom_conversations = [
    [
        "Your first question here",
        "Follow-up question",
        "Final question"
    ]
]

# Then modify test_conversation.py to use your custom cases
```

## Test Types

### 1. Streaming Chat Tests

**Purpose**: Test the real-time streaming functionality
**File**: `test_conversation.py`
**What it tests**:
- Server-Sent Events (SSE) streaming
- JSON token parsing
- Response completeness
- Error handling

**Example Output**:
```
User message: What's the weather like in Toronto today? Turn: 1
Calling with Payload: {"message": "...", "messages": []}
Assistant response: I don't have access to real-time weather data...
```

### 2. Response Quality Evaluation

**Purpose**: Assess AI response quality and reasonableness
**Service**: `reasonableness_service.py`
**Metrics**:
- Reasonableness rating (0.0 - 1.0)
- Response length validation
- Issue detection (too short, too long, empty)

**Example Output**:
```
📊 CONVERSATION SUMMARY
🗣️  Total turns: 3
🤖 Successful responses: 3
📈 Average reasonableness rating: 0.85/1.0
```

### 3. Database Integration Tests

**Purpose**: Verify conversation storage and retrieval
**Models**: `Conversation`, `ConversationResponse`, `ConversationResponseEvaluation`
**What it stores**:
- Complete conversation history
- Individual response evaluations
- Quality metrics and analysis

### 4. Error Handling Tests

**Purpose**: Test system resilience
**Scenarios**:
- Network timeouts
- Invalid payloads
- Service unavailability
- Malformed responses

## Understanding Test Results

### Success Indicators

✅ **Good Results**:
- All HTTP requests return 200 status
- Streaming tokens are received properly
- Reasonableness ratings > 0.7
- No critical issues detected
- Database records created successfully

### Warning Indicators

⚠️ **Needs Attention**:
- Reasonableness ratings 0.5 - 0.7
- Response length issues
- Some network timeouts
- Partial conversation completion

### Error Indicators

❌ **Critical Issues**:
- HTTP 422/500 errors
- Reasonableness ratings < 0.5
- Empty responses
- Database connection failures
- Complete conversation failures

### Sample Output Analysis

```
📊 CONVERSATION SUMMARY
🗣️  Total turns: 3
🤖 Successful responses: 3
📈 Average reasonableness rating: 0.85/1.0
💬 Conversation history length: 6 messages

🔍 DETAILED ANALYSIS:
   🎯 Average reasonableness: 0.85/1.0
   ⚠️  Total issues found: 0
   📏 Average response length: 245 characters

📋 TURN-BY-TURN BREAKDOWN:
   Turn 1: ✅ 0.88 (Quality: 0.88)
   Turn 2: ✅ 0.82 (Quality: 0.82)
   Turn 3: ✅ 0.85 (Quality: 0.85)
```

## Troubleshooting

### Common Issues

#### 1. 422 Unprocessable Entity Error

**Cause**: Payload format mismatch between test script and API
**Solution**: Ensure payload matches `ChatRequest` model structure

```python
# Correct format
payload = {
    "message": "user message",
    "messages": [
        {"role": "user", "content": "previous message"},
        {"role": "assistant", "content": "previous response"}
    ]
}
```

#### 2. Connection Refused

**Cause**: Router service not running
**Solution**: Start the router service first

```bash
cd backend/router
python main.py
```

#### 3. Database Connection Errors

**Cause**: Database not accessible or migrations not applied
**Solution**: Check database configuration and run migrations

```bash
cd backend/database
python migrate.py
```

#### 4. Timeout Errors

**Cause**: Slow response times or network issues
**Solution**: Increase timeout or check system performance

```python
# In test_conversation.py, line 101
timeout=60.0  # Increase from 30.0
```

#### 5. Empty Responses

**Cause**: AI service not responding or configuration issues
**Solution**: Check GPT service configuration and logs

### Debug Mode

Enable detailed logging by modifying the test script:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Add debug prints
print(f"Response status: {response.status_code}")
print(f"Response headers: {response.headers}")
```

## Advanced Testing

### Custom Test Scenarios

Create specialized test cases for specific functionality:

```python
# Test specific conversation patterns
def test_weather_conversation():
    weather_turns = [
        "What's the weather like today?",
        "Will it rain tomorrow?",
        "What should I wear?"
    ]
    return test_conversation(weather_turns)

# Test error handling
def test_error_scenarios():
    error_turns = [
        "",  # Empty message
        "x" * 10000,  # Very long message
        "Invalid JSON: {",  # Malformed content
    ]
    return test_conversation(error_turns)
```

### Performance Testing

Monitor system performance during tests:

```python
import time

start_time = time.time()
# Run test
end_time = time.time()
print(f"Test completed in {end_time - start_time:.2f} seconds")
```

### Load Testing

Test system under concurrent load:

```python
import asyncio

async def load_test():
    tasks = [
        test_conversation(conversation) 
        for conversation in conversations * 5  # 5x load
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

### Database Verification

Verify data integrity after tests:

```python
from database import get_db_session, Conversation

with get_db_session() as db:
    conversations = db.query(Conversation).all()
    print(f"Stored {len(conversations)} conversations")
    
    for conv in conversations:
        print(f"Conversation {conv.id}: {len(conv.conversation_json)} messages")
```

## Best Practices

1. **Always start with a clean database** before running tests
2. **Monitor system resources** during parallel testing
3. **Check logs** for detailed error information
4. **Validate results** by examining stored data
5. **Test edge cases** like empty messages and timeouts
6. **Use version control** to track test case changes
7. **Document custom test scenarios** for team members

## Integration with CI/CD

For automated testing in CI/CD pipelines:

```bash
# Run tests in CI environment
python test_conversation.py > test_results.log 2>&1

# Check exit code
if [ $? -eq 0 ]; then
    echo "Tests passed"
else
    echo "Tests failed"
    cat test_results.log
    exit 1
fi
```

## Support

For issues or questions about testing:

1. Check the logs in the router service output
2. Verify all prerequisites are met
3. Review the troubleshooting section above
4. Check the database for stored test results
5. Examine the reasonableness service configuration

---

*Last updated: $(date)*
*Test script version: test_conversation.py v1.0*
