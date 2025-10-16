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
from gpt_service import GptService
from nested_orchestrator import NestedOrchestrator
from agent_registry import get_predefined_agents
from prompts import get_prompt
from chat_types import ChatMessage

from whisper_client import WhisperSTTClient


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HealthCheckResponse(BaseModel):
    status: str
    ssl_enabled: bool
    ssl_status: str



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

# Initialize Gpt service if enabled
gpt_service = GptService(config, can_log=True)

# Initialize tools for the GPT service on startup
@app.on_event("startup")
async def startup_event():
    """Initialize GPT service tools on startup"""
    await gpt_service.init_tools()

    # Register sub-agents as tools
    from agent_registry import register_predefined_agents
    registered_agents = await register_predefined_agents(gpt_service, config)

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
        "tools_available": len(gpt_service._tool_registry),
        "tool_names": list(gpt_service._tool_registry.keys())
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


# ============================================================================
# Tool Management Endpoints
# ============================================================================

@app.get("/api/tools")
async def list_tools():
    """List available tools"""
    return {
        "tools": [
            {
                "name": name,
                "description": info.get("description", ""),
                "type": info.get("type", "unknown"),
                "input_schema": info.get("input_schema", {})
            }
            for name, info in gpt_service._tool_registry.items()
        ]
    }

@app.post("/api/tools/{tool_name}/test")
async def test_tool(tool_name: str, arguments: dict = {}):
    """Test a specific tool"""
    if tool_name not in gpt_service._tool_registry:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    try:
        result = await gpt_service._execute_tool(tool_name, arguments)
        return {"result": result}

    except Exception as e:
        logger.error(f"Tool test failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tool test failed: {str(e)}")


# ============================================================================
# Nested Orchestrator Factory Functions
# ============================================================================

def create_nested_research_system(config):
    """
    Create a nested orchestrator system using your existing agents at the top level:

    Main Orchestrator
    ├── research_agent
    ├── current_info_agent
    ├── creative_agent
    ├── technical_agent
    └── summary_agent

    Each agent has access to brave_search and fetch MCP tools.
    """
    from agent_tool import get_predefined_agents

    # Get your existing agents
    existing_agents = get_predefined_agents(config)
    permitted_agents = []
    # Removed brave_summarizer due to 0% success rate in testing - it consistently failed with "Unable to retrieve a Summarizer summary"
    permitted_mcp_tools = ["brave_web_search"]
    # INSERT_YOUR_CODE
    # Filter existing_agents to only include agents whose names are in permitted_agents
    existing_agents = [agent for agent in existing_agents if getattr(agent, "name", None) in permitted_agents]
    # Configure each agent to use brave_search and brave_summarizer tools

   # for agent in existing_agents:
   #     # Update each agent to only use MCP tools
   #     agent.available_tools = mcp_tools

    # Create main orchestrator with all agents at the top level
    main_orchestrator = NestedOrchestrator(
        model_config=config,
        name="main_orchestrator",
        description="Main coordination hub with all agents at top level",
        system_prompt=get_prompt("main_orchestrator"),
        sub_agents=existing_agents,  # All agents at top level
        available_tools=permitted_mcp_tools  # Set specific tools here
    )

    return main_orchestrator


@app.post("/api/stream")
async def stream_with_orchestrator(chat_request: ChatRequest, request: Request):
    """Enhanced streaming endpoint with orchestrator and sub-agent visibility"""

    # Build messages array with conversation history
    messages = chat_request.messages
    if not messages:
        messages = [ChatMessage(role="user", content=chat_request.message)]
    else:
        messages.append(ChatMessage(role="user", content=chat_request.message))

    async def orchestrator_event_stream():
        orchestrator_task = None

        try:
            # Create a nested orchestrator structure
            orchestrator = create_nested_research_system(config)

            # Initialize the orchestrator with the main GPT service
            await orchestrator.initialize(gpt_service, config)
            orchestrator.gpt_service = gpt_service

            # Use asyncio.Queue to stream events in real-time
            event_queue = asyncio.Queue()
            final_response = None
            sequence_counter = {"value": 0}  # Use dict for mutable closure

            def queue_event(event_type):
                """Create event handler that queues events with proper sequencing"""
                def handler(data):
                    event_data = {
                        "type": event_type,
                        "data": data,
                        "sequence": sequence_counter["value"]
                    }
                    sequence_counter["value"] += 1
                    try:
                        event_queue.put_nowait(event_data)
                    except asyncio.QueueFull:
                        logger.warning(f"Event queue full, dropping {event_type} event")
                return handler

            # Register event listeners - orchestrator handles sub-agent event propagation
            orchestrator.on("orchestrator_start", queue_event("orchestrator_start"))
            orchestrator.on("agent_token", queue_event("orchestrator_token"))
            orchestrator.on("orchestrator_complete", queue_event("orchestrator_complete"))
            orchestrator.on("sub_agent_event", queue_event("sub_agent_event"))
            orchestrator.on("tool_call_event", queue_event("tool_call_event"))

            # Start orchestrator in background
            orchestrator_task = asyncio.create_task(orchestrator.run(messages))

            # Stream events as they come in
            while True:
                try:
                    # Wait for either an event or orchestrator completion
                    done, pending = await asyncio.wait(
                        [
                            asyncio.create_task(event_queue.get()),
                            orchestrator_task
                        ],
                        return_when=asyncio.FIRST_COMPLETED
                    )

                    # Check if orchestrator is done
                    if orchestrator_task in done:
                        final_response = await orchestrator_task

                        # Cancel pending event queue task
                        for task in pending:
                            task.cancel()

                        # Drain remaining events from queue
                        while not event_queue.empty():
                            try:
                                event = event_queue.get_nowait()
                                if await request.is_disconnected():
                                    return

                                yield {
                                    "data": json.dumps(event),
                                    "event": event.get("type", "unknown")
                                }
                            except asyncio.QueueEmpty:
                                break
                        break

                    # Process events
                    for task in done:
                        if task != orchestrator_task:
                            event = await task
                            if await request.is_disconnected():
                                logger.info("Client disconnected, stopping stream")
                                orchestrator_task.cancel()
                                return

                            if isinstance(event, dict):
                                yield {
                                    "data": json.dumps(event),
                                    "event": event.get("type", "unknown")
                                }

                    # Cancel pending event queue tasks (not the orchestrator)
                    for task in pending:
                        if task != orchestrator_task:
                            task.cancel()

                except asyncio.CancelledError:
                    logger.info("Stream cancelled")
                    break

            # Send final response
            if final_response:
                yield {
                    "data": json.dumps({
                        "type": "final_response",
                        "text": final_response.text,
                        "status": final_response.status,
                        "meta": final_response.meta,
                        "sequence": sequence_counter["value"]
                    }),
                    "event": "final_response"
                }
                sequence_counter["value"] += 1

            # Send end event
            yield {
                "data": json.dumps({
                    "finished": True,
                    "sequence": sequence_counter["value"]
                }),
                "event": "end"
            }

        except asyncio.TimeoutError:
            logger.error("Request timeout")
            yield {
                "data": json.dumps({"error": "Request timeout"}),
                "event": "error"
            }
        except Exception as e:
            logger.error(f"Stream error: {str(e)}", exc_info=True)
            yield {
                "data": json.dumps({
                    "error": "Internal server error",
                    "details": str(e)
                }),
                "event": "error"
            }
        finally:
            # Cleanup: cancel orchestrator task if still running
            if orchestrator_task and not orchestrator_task.done():
                logger.info("Cleaning up orchestrator task")
                orchestrator_task.cancel()
                try:
                    await orchestrator_task
                except asyncio.CancelledError:
                    pass

    return EventSourceResponse(orchestrator_event_stream())


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
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in speech-to-text endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Internal server error during transcription"
        )


# Specific embeddings routes
@app.get("/embeddings/health")
async def embeddings_health():
    """Proxy health check to embeddings service"""
    try:
        target_url = f"{config.EMBEDDINGS_URL}/health"
        logger.info(f"Checking embeddings health at: {target_url}")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                target_url,
                timeout=config.EMBEDDINGS_TIMEOUT,
            )

        logger.info(
            f"Embeddings health check responded with status: {response.status_code}"
        )
        return response.json()

    except httpx.ConnectError as e:
        logger.error(
            f"Failed to connect to embeddings service at {config.EMBEDDINGS_URL}: {str(e)}"
        )
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to embeddings service at {config.EMBEDDINGS_URL}",
        )
    except Exception as e:
        logger.error(f"Error proxying embeddings health check: {str(e)}")
        raise HTTPException(
            status_code=502, detail="Failed to check embeddings service health"
        )


@app.post("/embeddings/embed")
async def embeddings_embed(request: Request):
    """Proxy embed requests to embeddings service"""
    try:
        # Log the target URL for debugging
        target_url = f"{config.EMBEDDINGS_URL}/embed"
        logger.info(f"Proxying embed request to: {target_url}")

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
                target_url,
                headers=forward_headers,
                content=body,
                timeout=config.EMBEDDINGS_TIMEOUT,
            )

        logger.info(f"Embeddings service responded with status: {response.status_code}")
        return response.json()

    except httpx.ConnectError as e:
        logger.error(
            f"Failed to connect to embeddings service at {config.EMBEDDINGS_URL}: {str(e)}"
        )
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to embeddings service at {config.EMBEDDINGS_URL}",
        )
    except httpx.TimeoutException as e:
        logger.error(f"Timeout connecting to embeddings service: {str(e)}")
        raise HTTPException(
            status_code=504,
            detail="Embeddings service timeout",
        )
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
