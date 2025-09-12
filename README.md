# Geist Backend - Docker Setup Guide

## Overview

This backend provides an AI chat API using FastAPI as the router and llama.cpp for inference. It includes OpenAI Harmony format support for improved GPT-OSS model responses.

## Architecture

```
[Client] → [Router:8000] → [Inference:8080]
             ↓                    ↓
         FastAPI API         llama.cpp server
         + Harmony           + GPT-OSS model
```

## Quick Start

### 🍎 Apple Silicon (Recommended for Local Development)

Docker has significant performance limitations on Apple Silicon. Use the local development script instead:

```bash
cd backend

# Start both services with full GPU acceleration (~15x faster than Docker)
./start-local-dev.sh

# Test the setup
./test-local-dev.sh

# Stop services: Press Ctrl+C in the start script terminal
```

### 🐳 Docker (Other Platforms)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 2. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

## Services

### Router Service (Port 8000)

- **Purpose**: API gateway and request handler
- **Features**:
  - OpenAI Harmony format support
  - Request routing to inference service
  - Response parsing and cleanup
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /api/chat` - Chat completion

### Inference Service (Port 8080)

- **Purpose**: Runs the GPT-OSS 20B model
- **Engine**: llama.cpp server
- **Model**: `gpt-oss-20b-Q4_K_S.gguf` (quantized)
- **Endpoints**:
  - `/v1/completions` - Used with Harmony format
  - `/v1/chat/completions` - Standard chat format

## Configuration

### Environment Variables

#### Router Service

- `HARMONY_ENABLED` - Enable/disable Harmony format (default: true)
- `HARMONY_REASONING_EFFORT` - Reasoning depth: low/medium/high (default: low)
- `INFERENCE_URL` - Inference service URL (default: http://inference:8080)
- `LOG_LEVEL` - Logging level (default: DEBUG)

#### Inference Service

- `MODEL_PATH` - Path to GGUF model file
- `HOST` - Server host (default: 0.0.0.0)
- `PORT` - Server port (default: 8080)
- `CONTEXT_SIZE` - Context window size (default: 4096)
- `THREADS` - CPU threads (0 = auto)
- `GPU_LAYERS` - GPU layers for acceleration (0 = CPU only)

## Development Workflow

### Rebuild After Code Changes

```bash
# Stop services
docker-compose down

# Rebuild router (after code changes)
docker-compose build router

# Restart services
docker-compose up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f router
docker-compose logs -f inference
```

### Clean Restart

```bash
# Complete cleanup and restart
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Harmony Format

The backend uses OpenAI Harmony format to improve GPT-OSS model responses:

- **Enabled**: Model receives structured conversation context
- **Disabled**: Standard chat completion format

Harmony provides:

- Better reasoning with analysis channels
- Cleaner final responses
- Mobile-optimized brevity
- Structured token handling

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs router
docker-compose logs inference

# Verify health
docker-compose ps
```

### Model Loading Issues

```bash
# Check if model file exists
docker-compose exec inference ls -la /models/

# Check inference logs
docker-compose logs inference | grep -i error
```

### Harmony Import Errors

```bash
# Rebuild router with fresh dependencies
docker-compose build --no-cache router
```

### Port Conflicts

```bash
# Check if ports are in use
lsof -i :8000
lsof -i :8080

# Use different ports in docker-compose.yml
```

## Testing Harmony

### With Harmony (default)

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain quantum computing in one sentence"}'
```

### Without Harmony

```bash
# Modify docker-compose.yml: HARMONY_ENABLED=false
docker-compose up -d router

# Test again
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain quantum computing in one sentence"}'
```

## Project Structure

```
backend/
├── docker-compose.yml      # Service orchestration
├── router/
│   ├── Dockerfile         # Router container
│   ├── main.py           # FastAPI application
│   ├── harmony_service.py # Harmony format handler
│   ├── config.py         # Configuration
│   └── pyproject.toml    # Dependencies
└── inference/
    ├── Dockerfile         # Inference container
    └── model/            # Model files (mounted)
```

## Next Steps

- [ ] Add authentication
- [ ] Implement streaming responses
- [ ] Add request caching
- [ ] Set up monitoring/metrics
- [ ] Configure HTTPS with nginx

## Status

- 4CST in CET doesnt work in prod but in dev
- Follow up on exercise works in prod but not in dev
- I guess it has something to do with harmony main prompt
