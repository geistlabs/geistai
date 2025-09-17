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
```bash
docker build -t embeddings .
docker run -p 8001:8001 embeddings
```

### Local Development
```bash
pip install -r requirements.txt
python main.py
```

## Performance Notes

- First request may be slower as models are downloaded and cached
- Models are cached in memory after first load
- CPU-only inference (GPU support can be added if needed)
- Efficient for small to medium workloads
