from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, Depends
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
from revenuecat_auth import require_premium, get_user_id
from agent_tool import create_pricing_agent

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
    print(f"✅ Registered {len(registered_agents)} agent tools: {registered_agents}")

    print(f"✅ GPT service initialized with {len(gpt_service._tool_registry)} total tools")
    print(f"🔧 Available tools: {list(gpt_service._tool_registry.keys())}")

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

    # Configure each agent to use brave_search and brave_summarizer tools
    mcp_tools = ["brave_web_search",  "fetch"]

    for agent in existing_agents:
        # Update each agent to only use MCP tools
        agent.available_tools = mcp_tools
        print(f"🎯 Configured {agent.name} with tools: {mcp_tools}")

    # Create main orchestrator with all agents at the top level
    main_orchestrator = NestedOrchestrator(
        model_config=config,
        name="main_orchestrator",
        description="Main coordination hub with all agents at top level",
        system_prompt=get_prompt("main_orchestrator"),
        sub_agents=existing_agents,  # All agents at top level
        available_tools=['research_agent', 'current_info_agent', 'creative_agent',]  # Set specific tools here
    )

    return main_orchestrator


@app.post("/api/stream")
async def stream_with_orchestrator(
    chat_request: ChatRequest,
    request: Request,
    user_id: str = Depends(require_premium)
):
    """Enhanced streaming endpoint with orchestrator and sub-agent visibility"""
    logger.info(f"[Premium User: {user_id}] Processing chat request")
    print(f"[Backend] Received orchestrator request: {chat_request.model_dump_json(indent=2)}")

    # Build messages array with conversation history
    if chat_request.messages:
        messages = [msg.dict() for msg in chat_request.messages]
        messages.append({"role": "user", "content": chat_request.message})
    else:
        messages = [{"role": "user", "content": chat_request.message}]

    print(f"[Backend] Created messages array with {len(messages)} messages")

    async def orchestrator_event_stream():
        chunk_sequence = 0
        print(f"INFERENCE_URL: {config.INFERENCE_URL}")


        try:
            # Always use nested orchestrator (can handle single-layer or multi-layer)
            print("🎯 Using nested orchestrator mode")
            # Create a nested orchestrator structure
            orchestrator = create_nested_research_system(config)
            print(f"🎯 Created nested orchestrator: {orchestrator.name}")
            print(f"🎯 Agent hierarchy: {orchestrator.get_agent_hierarchy()}")

            # Initialize the orchestrator with the main GPT service
            await orchestrator.initialize(gpt_service, config)

            # Configure available tools (only sub-agents, not MCP tools)
            all_tools = list(gpt_service._tool_registry.keys())
            # Filter to only include sub-agents (not MCP tools like brave_web_search, fetch, etc.)
            sub_agent_names = ['research_agent', 'current_info_agent', 'creative_agent']#, 'brave_web_search', 'fetch']
            available_tool_names = [tool for tool in all_tools if tool in sub_agent_names]
            print(f"🎯 Orchestrator tools (sub-agents only): {available_tool_names}")

            # Set the available tools on the orchestrator
            orchestrator.available_tools = available_tool_names

            # Make sure the orchestrator uses the main GPT service with all tools
            orchestrator.gpt_service = gpt_service

            # Simple approach: just run the orchestrator and capture events
            events_captured = []

            def capture_event(event_type):
                def handler(data):
                    events_captured.append({
                        "type": event_type,
                        "data": data,
                        "sequence": chunk_sequence
                    })
                return handler

            # Register event listeners BEFORE running the orchestrator
            orchestrator.on("orchestrator_start", capture_event("orchestrator_start"))
            orchestrator.on("agent_token", capture_event("orchestrator_token"))
            orchestrator.on("orchestrator_complete", capture_event("orchestrator_complete"))
            orchestrator.on("sub_agent_event", capture_event("sub_agent_event"))
            orchestrator.on("tool_call_event", capture_event("tool_call_event"))

            # Also listen to sub-agent events directly
            for sub_agent in orchestrator.sub_agents:
                sub_agent.on("agent_start", capture_event("sub_agent_event"))
                sub_agent.on("agent_token", capture_event("sub_agent_event"))
                sub_agent.on("agent_complete", capture_event("sub_agent_event"))
                sub_agent.on("agent_error", capture_event("sub_agent_event"))

            # Run the orchestrator
            print(f"🚀 Starting orchestrator with message: {chat_request.message}")
            final_response = await orchestrator.run(chat_request.message)
            print(f"✅ Orchestrator completed with status: {final_response.status}")

            # Send all captured events
            for event in events_captured:
                if await request.is_disconnected():
                    return

                yield {
                    "data": json.dumps(event),
                    "event": event.get("type", "unknown")
                }
                chunk_sequence += 1

            # Send final response (citations are now handled by frontend)
            if final_response:
                yield {
                    "data": json.dumps({
                        "type": "final_response",
                        "text": final_response.text,

                        "status": final_response.status,
                        "meta": final_response.meta,
                        "sequence": chunk_sequence
                    }),
                    "event": "final_response"
                }
                chunk_sequence += 1

            # Send end event
            yield {"data": json.dumps({"finished": True}), "event": "end"}

        except asyncio.TimeoutError as e:
            yield {"data": json.dumps({"error": "Request timeout"}), "event": "error"}
        except Exception as e:
            print(f"Error in orchestrator stream: {e}")
            import traceback
            traceback.print_exc()
            yield {
                "data": json.dumps({"error": "Internal server error"}),
                "event": "error"
            }

    return EventSourceResponse(orchestrator_event_stream())


@app.post("/api/negotiate")
async def negotiate_pricing(
    chat_request: ChatRequest,
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """
    Streaming endpoint for price negotiation using LLM pricing agent

    Returns: Server-Sent Events with negotiation messages
    """
    try:
        logger.info(f"[Negotiate] Starting negotiation for user: {user_id}")

        # Create pricing agent
        pricing_agent = create_pricing_agent(config)
        await pricing_agent.initialize(gpt_service, config)

        async def event_generator():
            try:
                # Build full conversation context
                conversation_context = ""
                if chat_request.messages:
                    # Convert messages to context string for the agent
                    for msg in chat_request.messages:
                        conversation_context += f"{msg.role.upper()}: {msg.content}\n"

                # Run the agent with streaming events
                events_captured = []

                def capture_event(event_type):
                    def handler(data):
                        events_captured.append({
                            "type": event_type,
                            "data": data
                        })
                    return handler

                # Register event listeners BEFORE running the agent
                pricing_agent.on("agent_start", capture_event("agent_start"))
                pricing_agent.on("agent_token", capture_event("agent_token"))
                pricing_agent.on("agent_complete", capture_event("agent_complete"))
                pricing_agent.on("agent_error", capture_event("agent_error"))

                # Run the pricing agent
                logger.info(f"[Negotiate] Running pricing agent with message: {chat_request.message}")
                final_response = await pricing_agent.run(
                    chat_request.message,
                    context=conversation_context
                )
                logger.info(f"[Negotiate] Pricing agent completed: {final_response.status}")

                # Send all captured events
                for event in events_captured:
                    if await request.is_disconnected():
                        return

                    yield json.dumps(event)

                # Send final response
                final_response_event = {
                    'type': 'final_response',
                    'text': final_response.text,
                    'status': final_response.status,
                    'agent': final_response.agent_name,
                    'meta': final_response.meta
                }
                yield json.dumps(final_response_event)

                # Send end event
                yield json.dumps({'finished': True})

            except Exception as e:
                logger.error(f"[Negotiate] Error in stream: {str(e)}")
                import traceback
                traceback.print_exc()
                yield json.dumps({'error': str(e)})

        return EventSourceResponse(
            event_generator(),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"[Negotiate] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/speech-to-text")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    user_id: str = Depends(require_premium)
):
    """
    Transcribe audio using Whisper.cpp

    Args:
        audio_file: Audio file to transcribe (WAV format preferred)
        language: Optional language code (e.g., 'en', 'es', 'fr') for forced language detection
        user_id: Verified premium user ID

    Returns:
        JSON response with transcription results
    """
    logger.info(f"[Premium User: {user_id}] Processing audio transcription")
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
async def embeddings_embed(request: Request, user_id: str = Depends(require_premium)):
    """Proxy embed requests to embeddings service"""
    logger.info(f"[Premium User: {user_id}] Creating embeddings")
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
