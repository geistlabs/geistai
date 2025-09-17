from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional
import httpx
import asyncio
import json
import logging
import config
from harmony_service import HarmonyService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HealthCheckResponse(BaseModel):
    status: str
    ssl_enabled: bool
    ssl_status: str


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    messages: Optional[List[ChatMessage]] = None


app = FastAPI(title="Geist Router")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Allow webapp origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Harmony service if enabled
harmony_service = HarmonyService() if config.HARMONY_ENABLED else None

# Validate SSL configuration on startup
ssl_valid, ssl_message = config.validate_ssl_config()
if config.SSL_ENABLED and not ssl_valid:
    logger.error(f"SSL configuration error: {ssl_message}")
    raise RuntimeError(f"SSL configuration error: {ssl_message}")
elif config.SSL_ENABLED:
    logger.info(f"SSL enabled: {ssl_message}")
else:
    logger.info("SSL disabled - running in HTTP mode")


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


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint for backwards compatibility"""
    # Prepare messages for the model
    if request.messages:
        # Use provided conversation history and add the new message
        messages = [msg.dict() for msg in request.messages]
        messages.append({"role": "user", "content": request.message})
    else:
        # Fallback to single message if no history provided
        messages = [{"role": "user", "content": request.message}]

    # Process chat request through harmony service
    if harmony_service and config.HARMONY_ENABLED:
        ai_response = await harmony_service.process_chat_request(
            messages, config, reasoning_effort=config.HARMONY_REASONING_EFFORT
        )
    else:
        # Fallback - direct HTTP call without harmony service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.INFERENCE_URL}/v1/chat/completions",
                json={"messages": messages, "temperature": 0.7, "max_tokens": config.MAX_TOKENS},
                timeout=config.INFERENCE_TIMEOUT,
            )

        result = response.json()
        raw_response = result["choices"][0]["message"]["content"]

        # Parse Harmony channels even in fallback path
        if harmony_service:
            ai_response = harmony_service.parse_harmony_channels(raw_response)
        else:
            ai_response = raw_response

    return {"response": ai_response}


@app.post("/api/chat/stream")
async def chat_stream(chat_request: ChatRequest, request: Request):
    """Streaming chat endpoint using Server-Sent Events"""
    print(f"[Backend] Received from frontend: {chat_request.model_dump_json(indent=2)}")
    
    # Build messages array with conversation history
    if chat_request.messages:
        # Use provided conversation history and add the new message
        messages = [msg.dict() for msg in chat_request.messages]
        messages.append({"role": "user", "content": chat_request.message})
    else:
        # Fallback to single message if no history provided
        messages = [{"role": "user", "content": chat_request.message}]
    
    print(f"[Backend] Created messages array with {len(messages)} messages")

    async def event_stream():
        chunk_sequence = 0
        try:
            # Stream tokens from harmony service
            async for token in harmony_service.stream_chat_request(
                messages, config, reasoning_effort=config.HARMONY_REASONING_EFFORT
            ):
                # Check if client is still connected
                if await request.is_disconnected():
                    break

                # Send token as SSE event (no encryption)
                yield {
                    "data": json.dumps({"token": token, "sequence": chunk_sequence}),
                    "event": "chunk",
                }
                chunk_sequence += 1

            # Send end event
            yield {"data": json.dumps({"finished": True}), "event": "end"}

        except asyncio.TimeoutError as e:
            yield {"data": json.dumps({"error": "Request timeout"}), "event": "error"}
        except Exception as e:
            yield {
                "data": json.dumps({"error": "Internal server error"}),
                "event": "error",
            }

    return EventSourceResponse(event_stream())


# Proxy route for embeddings service
@app.api_route(
    "/embeddings/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def proxy_embeddings(request: Request, path: str):
    """Proxy requests to the embeddings service"""
    try:
        # Build the target URL
        target_url = f"{config.EMBEDDINGS_URL}/{path}"

        # Get query parameters
        query_params = str(request.url.query)
        if query_params:
            target_url += f"?{query_params}"

        # Get request body if present
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.body()

        # Forward the request
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=dict(request.headers),
                content=body,
                timeout=config.EMBEDDINGS_TIMEOUT,
            )

        # Return the response
        return StreamingResponse(
            iter([response.content]),
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.headers.get("content-type"),
        )

    except Exception as e:
        logger.error(f"Error proxying to embeddings service: {str(e)}")
        return {"error": "Failed to proxy request to embeddings service"}


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

# TEST INFERENCE SERVER CONNECTION
# curl -X POST https://inference.geist.im/v1/chat/completions -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hello how are you"}],"temperature":0.7,"max_tokens":100}'
