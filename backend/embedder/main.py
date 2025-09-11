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
    ssl_enabled: bool
    ssl_status: str

class EmbedRequest(BaseModel):
    input: Union[str, List[str]]
    model: str = "all-MiniLM-L6-v2"

class EmbedResponse(BaseModel):
    object: str = "list"
    data: List[dict]
    model: str
    usage: dict

app = FastAPI(title="Geist Embedder")

# Validate SSL configuration on startup
ssl_valid, ssl_message = config.validate_ssl_config()
if config.SSL_ENABLED and not ssl_valid:
    logger.error(f"SSL configuration error: {ssl_message}")
    raise RuntimeError(f"SSL configuration error: {ssl_message}")
elif config.SSL_ENABLED:
    logger.info(f"SSL enabled: {ssl_message}")
else:
    logger.info("SSL disabled - running in HTTP mode")

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
    """Health check endpoint that includes SSL status."""
    ssl_valid, ssl_message = config.validate_ssl_config()
    return {
        "status": "healthy",
        "ssl_enabled": config.SSL_ENABLED,
        "ssl_status": ssl_message,
    }


@app.get("/ssl/info")
def ssl_info():
    """Get SSL configuration and certificate information."""
    ssl_valid, ssl_message = config.validate_ssl_config()
    
    info = {
        "ssl_enabled": config.SSL_ENABLED,
        "ssl_valid": ssl_valid,
        "ssl_status": ssl_message,
        "cert_path": config.SSL_CERT_PATH,
        "key_path": config.SSL_KEY_PATH,
    }
    
    if config.SSL_ENABLED and ssl_valid:
        try:
            import ssl
            import socket
            from datetime import datetime
            
            # Load certificate and get basic info
            with open(config.SSL_CERT_PATH, "rb") as f:
                cert_data = f.read()
            
            # Parse certificate (basic info)
            cert_lines = cert_data.decode("utf-8").split("\n")
            cert_info = {}
            
            for line in cert_lines:
                if "BEGIN CERTIFICATE" in line:
                    cert_info["format"] = "PEM"
                    break
            
            info["certificate"] = {
                "format": cert_info.get("format", "Unknown"),
                "size_bytes": len(cert_data),
            }
            
        except Exception as e:
            info["certificate"] = {"error": f"Could not read certificate: {str(e)}"}
    
    return info


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
    import sys

    try:
        if config.SSL_ENABLED:
            logger.info(
                f"Starting server with SSL on {config.API_HOST}:{config.API_PORT}"
            )
            logger.info(f"SSL Certificate: {config.SSL_CERT_PATH}")
            logger.info(f"SSL Private Key: {config.SSL_KEY_PATH}")
            
            uvicorn.run(
                app,
                host=config.API_HOST,
                port=config.API_PORT,
                ssl_keyfile=config.SSL_KEY_PATH,
                ssl_certfile=config.SSL_CERT_PATH,
                log_level="info",
            )
        else:
            logger.info(
                f"Starting server without SSL on {config.API_HOST}:{config.API_PORT}"
            )
            uvicorn.run(
                app, host=config.API_HOST, port=config.API_PORT, log_level="info"
            )
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        sys.exit(1)
