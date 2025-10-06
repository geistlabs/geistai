from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional
import httpx
import asyncio
import json
import logging
import os
import config
from harmony_service import HarmonyService
from whisper_client import WhisperSTTClient


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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://geist.im",
        "https://webapp.geist.im",
        "https://router.geist.im",
        "https://inference.geist.im",
        "https://embeddings.geist.im",
        "http://geist.im",
        "http://webapp.geist.im",
        "http://router.geist.im",
        "http://inference.geist.im",
        "http://embeddings.geist.im",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Harmony service if enabled
harmony_service = HarmonyService() if config.HARMONY_ENABLED else None

# Initialize Whisper STT client
whisper_service_url = os.getenv(
    "WHISPER_SERVICE_URL", "http://whisper-stt-service:8000"
)
stt_service = WhisperSTTClient(whisper_service_url)

logger.info(f"Whisper STT client initialized with service URL: {whisper_service_url}")

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
                json={
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": config.MAX_TOKENS,
                },
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


@app.post("/api/speech-to-text")
async def transcribe_audio(
    audio_file: UploadFile = File(...), language: Optional[str] = Form(None)
):
    """
    Transcribe audio using Whisper.cpp

    Args:
        audio_file: Audio file to transcribe (WAV format preferred)
        language: Optional language code (e.g., 'en', 'es', 'fr') for forced language detection

    Returns:
        JSON response with transcription results
    """
    if not stt_service:
        raise HTTPException(
            status_code=503,
            detail="STT service not available - whisper binary or model not found",
        )

    try:
        # Read audio file content
        audio_data = await audio_file.read()

        # Validate file size (max 25MB)
        if len(audio_data) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=413, detail="Audio file too large. Maximum size is 25MB."
            )

        # Transcribe using STT service
        result = await stt_service.transcribe_audio(audio_data, language)
        logger.info(f"STT transcription result: {result}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in speech-to-text endpoint: {str(e)}")
        # Return a proper JSON error response instead of raising HTTPException
        return {
            "success": False,
            "text": "",
            "error": f"Transcription failed: {str(e)}",
            "duration": 0,
            "language": language or "auto",
            "segments": []
        }


# Specific embeddings routes
@app.get("/embeddings/health")
async def embeddings_health():
    """Proxy health check to embeddings service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{config.EMBEDDINGS_URL}/health",
                timeout=config.EMBEDDINGS_TIMEOUT,
            )
            return response.json()
    except Exception as e:
        logger.error(f"Error proxying embeddings health check: {str(e)}")
        raise HTTPException(
            status_code=502, detail="Failed to check embeddings service health"
        )


@app.post("/embeddings/embed")
async def embeddings_embed(request: Request):
    """Proxy embed requests to embeddings service"""
    try:
        # Get request body
        body = await request.body()

        # Prepare headers for forwarding (exclude hop-by-hop headers)
        forward_headers = {}
        skip_headers = {
            "host",
            "connection",
            "upgrade",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
        }

        for key, value in request.headers.items():
            if key.lower() not in skip_headers:
                forward_headers[key] = value

        # Forward the request to embeddings service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.EMBEDDINGS_URL}/embed",
                headers=forward_headers,
                content=body,
                timeout=config.EMBEDDINGS_TIMEOUT,
            )

        return response.json()

    except Exception as e:
        logger.error(f"Error proxying embeddings embed request: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Failed to proxy embed request to embeddings service",
        )


# Proxy route for embeddings service (catch-all for other routes)
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

        # Prepare headers for forwarding (exclude hop-by-hop headers)
        forward_headers = {}
        skip_headers = {
            "host",
            "connection",
            "upgrade",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
        }

        for key, value in request.headers.items():
            if key.lower() not in skip_headers:
                forward_headers[key] = value

        # Forward the request
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body,
                timeout=config.EMBEDDINGS_TIMEOUT,
            )

        # Prepare response headers (exclude hop-by-hop headers)
        response_headers = {}
        for key, value in response.headers.items():
            if key.lower() not in skip_headers:
                response_headers[key] = value

        # Return the response
        return StreamingResponse(
            iter([response.content]),
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type"),
        )

    except Exception as e:
        logger.error(f"Error proxying to embeddings service: {str(e)}")
        raise HTTPException(
            status_code=502, detail="Failed to proxy request to embeddings service"
        )


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
