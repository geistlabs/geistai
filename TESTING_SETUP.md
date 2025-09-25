# Testing Setup Guide

This guide explains how to set up and run tests for the Geist AI router service, both locally and in GitHub Actions.

## Environment Requirements

### Local Development

1. **Python 3.11+** - Required for the router service
2. **Docker & Docker Compose** - For running the full stack
3. **OpenAI API Key** - For reasonableness service (optional for basic tests)

### GitHub Actions Environment

The CI environment automatically provides:
- Ubuntu 22.04 runner
- Python 3.11
- Docker services (nginx mock for inference)
- Cached pip dependencies

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for reasonableness service | `sk-proj-...` |
| `INFERENCE_URL` | URL of the inference service | `http://localhost:8080` |
| `EMBEDDINGS_URL` | URL of the embeddings service | `http://localhost:8001` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HARMONY_ENABLED` | Enable Harmony reasoning | `true` |
| `HARMONY_REASONING_EFFORT` | Reasoning level (low/medium/high) | `low` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `INFERENCE_TIMEOUT` | Inference service timeout | `60` |
| `EMBEDDINGS_TIMEOUT` | Embeddings service timeout | `60` |

## Local Setup

### 1. Install Dependencies

```bash
cd backend/router
pip install -e .
pip install python-dotenv
```

### 2. Create Environment File

```bash
cd backend
cp env.example .env
# Edit .env with your actual API key
```

### 3. Start Services

```bash
# Start the full stack
docker-compose -f docker-compose.chris.yml up -d

# Or start just the router for testing
cd router
python main.py &
```

### 4. Run Tests

```bash
cd backend/router

# Run individual tests
python test_health_endpoint.py
python test_streaming.py
python test_conversation.py

# Run CI-compatible tests
python test_streaming_ci.py
python test_conversation_ci.py
```

## GitHub Actions Setup

### 1. Repository Secrets

Add these secrets in your GitHub repository settings:

- `OPENAI_API_KEY`: Your actual OpenAI API key (for real testing)

### 2. Workflow Triggers

The workflow runs on:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Manual trigger via GitHub Actions UI

### 3. Test Environment

The CI environment:
- Uses nginx as a mock inference service
- Creates test-specific environment variables
- Waits for services to be ready before testing
- Runs comprehensive test suite
- Cleans up services after tests

## Test Files

### Core Test Files

| File | Purpose | CI Compatible |
|------|---------|---------------|
| `test_health_endpoint.py` | Health check endpoint | ✅ |
| `test_streaming.py` | Streaming chat functionality | ❌ (uses real services) |
| `test_conversation.py` | Multi-turn conversations | ❌ (uses real services) |

### CI-Compatible Test Files

| File | Purpose | Description |
|------|---------|-------------|
| `test_streaming_ci.py` | Streaming tests for CI | Simplified, mock-friendly |
| `test_conversation_ci.py` | Conversation tests for CI | Basic validation only |

## Troubleshooting

### Common Issues

1. **Service not ready**: Wait for health checks to pass
2. **Missing API key**: Ensure `.env` file is created and populated
3. **Port conflicts**: Check if ports 8000, 8080, 8001 are available
4. **Docker issues**: Ensure Docker is running and accessible

### Debug Commands

```bash
# Check service health
curl http://localhost:8000/health

# Check environment variables
cd backend/router
python -c "import config; print(config.OPENAI_KEY)"

# View service logs
docker-compose -f backend/docker-compose.chris.yml logs router
```

### CI Debugging

- Check the "Wait for router to be ready" step
- Look for error messages in test output
- Verify environment variables are set correctly
- Check if mock services are responding

## Test Coverage

The test suite covers:

- ✅ Health endpoint functionality
- ✅ Streaming chat responses
- ✅ Multi-turn conversations
- ✅ Error handling
- ✅ Response validation
- ✅ Service integration

## Performance Considerations

- Tests use 30-second timeouts
- Mock services reduce external dependencies
- CI tests are optimized for speed
- Local tests can use real services for thorough validation

## Security Notes

- API keys are stored as GitHub secrets
- `.env` files should be in `.gitignore`
- Test API keys are used in CI environment
- No sensitive data is logged in test output
