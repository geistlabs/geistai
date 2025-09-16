# Geist Backend

Production-ready AI chat backend with FastAPI router and llama.cpp inference server.

## Architecture

- **Router Service** (FastAPI): Handles HTTP requests, Harmony format, streaming
- **Inference Service** (llama.cpp): Runs GPT-OSS 20B model with GPU acceleration

## Development Options

### 🍎 Apple Silicon (Recommended for Local Development)

Docker has significant performance limitations on Apple Silicon. Use the local development script instead:

```bash
# Start both services with full GPU acceleration
./start-local-dev.sh

# Test the setup
./test-local-dev.sh

# Stop services: Press Ctrl+C in the start script terminal
```

**Performance**: ~15x faster than Docker (1-2 seconds vs 20+ seconds)

**Features**:
- Full Apple M3 Pro Metal GPU acceleration (all 32 layers)
- Real-time streaming responses  
- Native performance without container overhead

### 🐳 Docker (Other Platforms)

For Linux/Windows or deployment:

```bash
# Start services
docker compose up

# Stop services
docker compose down
```

**⚠️ GPU Configuration Required**: Update `docker-compose.yml` GPU settings based on your hardware:

```yaml
# For NVIDIA GPUs
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]

# For Apple Silicon (limited performance)
environment:
  - GPU_LAYERS=32  # Adjust based on available VRAM

# For CPU-only
environment:
  - GPU_LAYERS=0
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/chat` | POST | Regular chat (blocking) |
| `/api/chat/stream` | POST | Streaming chat (recommended) |

### Example Usage

```bash
# Health check
curl http://localhost:8000/health

# Regular chat
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello! How are you?"}'

# Streaming chat (real-time tokens)
curl -N -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about AI"}'
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HARMONY_ENABLED` | `true` | Enable GPT-OSS Harmony format |
| `HARMONY_REASONING_EFFORT` | `low` | Reasoning depth (`low`/`medium`/`high`) |
| `INFERENCE_URL` | `http://localhost:8080` | Inference server URL |
| `INFERENCE_TIMEOUT` | `60` | Request timeout (seconds) |
| `API_HOST` | `0.0.0.0` | Router bind address |
| `API_PORT` | `8000` | Router port |
| `GPU_LAYERS` | `32` | Number of model layers on GPU |

## Model

- **GPT-OSS 20B** with Q4_K_S quantization (~11GB)
- **Harmony Format**: Structured reasoning with analysis/final channels
- **Context**: 4096 tokens (expandable to 131K)

## Performance Notes

### Apple Silicon
- **Local development**: 1-2 second responses
- **Docker**: 20+ second responses (not recommended)
- **GPU**: All 25 model layers run on Metal

### Other Platforms
- **NVIDIA GPU**: Excellent performance with CUDA
- **CPU-only**: Slower but functional (set `GPU_LAYERS=0`)

## Troubleshooting

**Port conflicts**:
```bash
# Stop Docker first
docker compose down

# Kill processes on specific ports
lsof -ti :8080 | xargs kill -9  # Inference
lsof -ti :8000 | xargs kill -9  # Router
```

**Apple Silicon GPU not working**:
- Ensure Metal backend is built in llama.cpp
- Check GPU layers setting in script/docker-compose
- Monitor GPU usage: `sudo powermetrics --samplers gpu_power -n 1`

**Model not found**:
- Verify `models/gpt-oss-20b-Q4_K_S.gguf` exists
- Download if missing (model source in docker-compose comments)

## Development Workflow

### 🔥 Live Development Mode (NEW!)

For rapid development with automatic code reloading:

```bash
# Start all services with live reload enabled
./start-dev.sh
```

**Features**:
- 🔄 **Auto-restart** on code changes (router & embeddings services)
- 📁 **Volume mounts** for real-time file sync
- 🚀 **Fast iteration** - no rebuild needed for code changes
- 📊 **Live logs** monitoring
- 🛑 **Easy cleanup** with Ctrl+C
- 📝 **Single config file** - all settings in one docker-compose.yml

**What gets live-reloaded**:
- `./router/` - FastAPI router service (Python files)
- `./embeddings/` - Embedding service (Python files)
- Configuration changes in `config.py`
- New endpoints, middleware, or business logic

**What doesn't get live-reloaded**:
- `./inference/` - Model server (expensive to restart)
- Docker configuration changes (requires rebuild)
- New Python dependencies (requires rebuild)

### Traditional Development Options

1. **Apple Silicon**: Use `./start-local-dev.sh` for maximum performance
2. **Other platforms**: Use `docker compose up` with proper GPU configuration
3. **Testing**: Use `./test-local-dev.sh` or manual curl commands
4. **Monitoring**: Check logs in `/tmp/` (local) or `docker logs` (container)

### Development Tips

**Making Code Changes**:
```bash
# 1. Start development mode
./start-dev.sh

# 2. Edit files in ./router/ or ./embeddings/
# Changes are automatically detected and services restart

# 3. Test your changes immediately
curl http://localhost:8000/health
```

**Adding New Dependencies**:
```bash
# 1. Stop services (Ctrl+C)
# 2. Update pyproject.toml
# 3. Rebuild and restart
docker compose build
./start-dev.sh
```

**Debugging**:
```bash
# View logs for specific service
docker compose logs -f router
docker compose logs -f embeddings
docker compose logs -f inference

# Check service status
docker compose ps
```

---

**Ready for blazing-fast AI chat development!** 🚀