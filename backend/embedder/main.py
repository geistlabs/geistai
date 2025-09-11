from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Union
import config
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HealthCheckResponse(BaseModel):
    status: str

class EmbedRequest(BaseModel):
    input: Union[str, List[str]]
    model: str = "all-MiniLM-L6-v2"

class EmbedResponse(BaseModel):
    object: str = "list"
    data: List[dict]
    model: str
    usage: dict

app = FastAPI(title="Geist Embedder")

# Global model cache
_model_cache = {}

def get_model(model_name: str) -> SentenceTransformer:
    """Load and cache the sentence transformer model"""
    if model_name not in _model_cache:
        logger.info(f"Loading model: {model_name}")
        try:
            _model_cache[model_name] = SentenceTransformer(model_name)
            logger.info(f"Successfully loaded model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise HTTPException(status_code=500, f"Failed to load model: {model_name}")
    return _model_cache[model_name]

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """Generate embeddings for input text(s)"""
    try:
        # Get the model
        model = get_model(request.model)
        
        # Prepare input texts
        if isinstance(request.input, str):
            texts = [request.input]
        else:
            texts = request.input
        
        # Generate embeddings
        logger.info(f"Generating embeddings for {len(texts)} text(s)")
        embeddings = model.encode(texts, convert_to_numpy=True)
        
        # Format response data
        data = []
        for i, embedding in enumerate(embeddings):
            data.append({
                "object": "embedding",
                "embedding": embedding.tolist(),
                "index": i
            })
        
        # Calculate token usage (rough estimate)
        total_tokens = sum(len(text.split()) for text in texts)
        
        return EmbedResponse(
            data=data,
            model=request.model,
            usage={
                "prompt_tokens": total_tokens,
                "total_tokens": total_tokens
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating embeddings: {str(e)}")

@app.get("/models")
def list_models():
    """List available embedding models"""
    return {
        "object": "list",
        "data": [
            {
                "id": "all-MiniLM-L6-v2",
                "object": "model",
                "created": 1677610602,
                "owned_by": "sentence-transformers"
            },
            {
                "id": "all-mpnet-base-v2", 
                "object": "model",
                "created": 1677610602,
                "owned_by": "sentence-transformers"
            },
            {
                "id": "paraphrase-MiniLM-L6-v2",
                "object": "model", 
                "created": 1677610602,
                "owned_by": "sentence-transformers"
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)
