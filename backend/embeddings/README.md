# Embedder Service

A self-hosted embeddings API using SentenceTransformers (SBERT) models.

## Features

- **Free to run**: No API costs, runs entirely on your infrastructure
- **Full data control**: Perfect for sensitive use cases requiring privacy
- **Multiple models**: Supports various SentenceTransformers models
- **OpenAI-compatible API**: Drop-in replacement for OpenAI embeddings API
- **Docker support**: Easy deployment with Docker and docker-compose

## API Endpoints

### POST /embed
Generate embeddings for text input(s).

**Request:**
```json
{
  "input": "Your text to embed",
  "model": "all-MiniLM-L6-v2"
}
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.2, ...],
      "index": 0
    }
  ],
  "model": "all-MiniLM-L6-v2",
  "usage": {
    "prompt_tokens": 4,
    "total_tokens": 4
  }
}
```

### GET /models
List available embedding models.

### GET /health
Health check endpoint.

## Available Models

- `all-MiniLM-L6-v2` (default): Fast and efficient, 384 dimensions
- `all-mpnet-base-v2`: Higher quality, 768 dimensions
- `paraphrase-MiniLM-L6-v2`: Good for paraphrase detection

## Environment Variables

- `API_HOST`: Host to bind to (default: 0.0.0.0)
- `API_PORT`: Port to bind to (default: 8001)
- `DEFAULT_MODEL`: Default model to use (default: all-MiniLM-L6-v2)
- `MODEL_CACHE_DIR`: Directory to cache models (default: /app/models)
- `MAX_BATCH_SIZE`: Maximum batch size for embeddings (default: 32)
- `MAX_TEXT_LENGTH`: Maximum text length (default: 8192)

## Usage

### With Docker Compose
The service is included in the main docker-compose.yml and will start automatically.

### Standalone Docker

**Optimized Build:**
```bash
# BuildKit is automatically enabled for optimized builds
docker build -t embeddings .
docker run -p 8001:8001 embeddings
```

### Local Development
```bash
pip install -r requirements.txt
python main.py
```

## Build Optimization

The Docker build has been optimized to reduce build times from 30+ minutes to ~5-10 minutes:

- **Multi-stage build**: Separates build dependencies from runtime
- **Layer caching**: Dependencies are cached separately from application code
- **Requirements.txt**: Better dependency management and caching
- **.dockerignore**: Reduces build context size
- **BuildKit support**: Enables advanced caching features
- **Pre-downloaded models**: Default model downloaded during build, not runtime
- **GitHub Actions caching**: CI/CD pipeline uses GitHub Actions cache for faster builds

### Build Performance Tips

1. **Automatic optimization**: BuildKit and caching are enabled by default
2. **Layer caching**: Dependencies are cached separately and rarely need rebuilding
3. **Pre-downloaded models**: Default model is included in the image for instant startup
4. **CI/CD caching**: GitHub Actions automatically caches layers between builds

## Performance Notes

- **Fast startup**: Default model pre-loaded during build and startup
- **Memory caching**: Models cached in memory after first load
- **CPU-optimized**: CPU-only PyTorch for smaller image size
- **Efficient inference**: Optimized for small to medium workloads
- **Build time**: ~5-10 minutes (optimized) vs 30+ minutes (original)
- **Model storage**: Models cached in `/opt/venv/models` for persistence
