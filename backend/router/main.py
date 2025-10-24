from events import EventEmitter
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
from prompts import get_prompt, get_summarizer_prompt
from chat_types import ChatMessage
from revenuecat_auth import require_premium, get_user_id
from agent_tool import create_pricing_agent

from whisper_client import WhisperSTTClient


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HealthCheckResponse(BaseModel):
    status: str



class ChatRequest(BaseModel):
    message: str
    messages: Optional[List[ChatMessage]] = None


class MemoryExtractionRequest(BaseModel):
    message: str
    messages: Optional[List[ChatMessage]] = None
    extract_memories: bool = (
        True  # Flag to indicate this is a memory extraction request
    )


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


# Initialize Whisper STT client
whisper_service_url = os.getenv(
    "WHISPER_SERVICE_URL", "http://whisper-stt-service:8000"
)
stt_service = WhisperSTTClient(whisper_service_url)

logger.info(f"Whisper STT client initialized with service URL: {whisper_service_url}")

gpt_service_instance: GptService | None = None

async def get_gpt_service():
    """
    Factory function that returns a GptService with a fresh event emitter.
    This allows us to reuse the same service instance but with different event emitters per request.
    """
    global gpt_service_instance
    
    # Initialize the service once if not already done
    if gpt_service_instance is None:
        # Create a temporary event emitter for initialization
        temp_emitter = EventEmitter()
        gpt_service_instance = GptService(config, temp_emitter, can_log=True)
        await gpt_service_instance.init_tools()
        logger.info("GptService initialized with tools")
    
    # Create a new instance with a fresh event emitter for each request
    fresh_emitter = EventEmitter()
    new_service = GptService(config, fresh_emitter, can_log=True)
    
    # Copy the tool registry from the initialized instance
    new_service._tool_registry = gpt_service_instance._tool_registry.copy()
    new_service._mcp_client = gpt_service_instance._mcp_client
    
    return new_service

@app.on_event("startup")
async def startup_event():
    """Initialize GptService on server startup"""
    await get_gpt_service()
    logger.info("Server startup complete - GptService initialized")
@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
    }


# ============================================================================
# Tool Management Endpoints
# ============================================================================


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
    permitted_mcp_tools = ["custom_mcp_fetch", "brave_web_search", "brave_summarizer"]
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


@app.post("/api/chat")
async def chat_with_orchestrator(chat_request: ChatRequest):
    """Non-streaming chat endpoint for simple requests"""
    print(f"[Backend] Received chat request: {chat_request.model_dump_json(indent=2)}")

    # Build messages array with conversation history
    if chat_request.messages:
        messages = [msg.dict() for msg in chat_request.messages]
        messages.append({"role": "user", "content": chat_request.message})
    else:
        messages = [{"role": "user", "content": chat_request.message}]

    print(f"[Backend] Created messages array with {len(messages)} messages")

    try:
        # Use the orchestrator for processing
        orchestrator = NestedOrchestrator(config)
        await orchestrator.initialize(gpt_service, config)
        
        # Get the response
        response = await orchestrator.run(chat_request.message, context="")
        
        return {"response": response.text}
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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

    try:
        # Create a nested orchestrator structure
        orchestrator = create_nested_research_system(config)

        # Initialize the orchestrator with the main GPT service
        if gpt_service_instance is None:
            current_gpt_service = await get_gpt_service()
        else:
            current_gpt_service = gpt_service_instance
        await orchestrator.initialize(current_gpt_service, config)

        # Configure available tools (only sub-agents) if tool calls are enabled
        if config.ENABLE_TOOL_CALLS:
            sub_agent_names = ["research_agent", "current_info_agent", "creative_agent"]
            all_tools = list(current_gpt_service._tool_registry.keys())
            available_tool_names = [
                tool for tool in all_tools if tool in sub_agent_names
            ]
            orchestrator.available_tools = available_tool_names
        else:
            orchestrator.available_tools = []
        orchestrator.gpt_service = current_gpt_service

        # Run the orchestrator and get the final response
        chat_messages = [ChatMessage(role="user", content=chat_request.message)]
        final_response = await orchestrator.run(chat_messages)

        return {
            "response": final_response.text,
            "status": final_response.status,
            "meta": final_response.meta,
        }

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def handle_memory(chat_request: ChatRequest):
    """Handle memory extraction requests with direct GPT service call"""
    print("[Backend] 🧠 Processing memory extraction request")

    # Build messages array
    if chat_request.messages:
        messages = [msg.dict() for msg in chat_request.messages]
        messages.append({"role": "user", "content": chat_request.message})
    else:
        messages = [{"role": "user", "content": chat_request.message}]

    try:
        if gpt_service_instance is None:
            current_gpt_service = await get_gpt_service()
        else:
            current_gpt_service = gpt_service_instance
        # Use direct GPT service call without orchestrator for clean response
        response_text = await current_gpt_service.process_chat_request(
            messages=messages,
            reasoning_effort="low",  # Use low reasoning for cleaner output
            system_prompt="You are a memory extraction assistant. Your job is to extract key facts from conversations and return ONLY a valid JSON array. Do not include any reasoning, explanations, or other text. Return only the JSON array starting with [ and ending with ].",
        )

        print(f"[Backend] 🧠 Raw GPT response: {response_text[:200]}...")

        # Extract JSON array from response
        json_start = response_text.find("[")
        json_end = response_text.rfind("]")

        if json_start != -1 and json_end != -1 and json_start < json_end:
            json_array = response_text[json_start : json_end + 1]
            print(f"[Backend] 🧠 Extracted JSON: {json_array}")

            import json as json_lib
            # Validate JSON
            try:

                parsed = json_lib.loads(json_array)
                if isinstance(parsed, list):
                    return {
                        "response": json_array,
                        "status": "success",
                        "meta": {"extracted_memories": len(parsed)},
                    }
                else:
                    print(
                        f"[Backend] 🧠 ❌ Parsed result is not an array: {type(parsed)}"
                    )
            except json_lib.JSONDecodeError as e:
                print(f"[Backend] 🧠 ❌ JSON parsing error: {e}")

        # Fallback: return the raw response if JSON extraction fails
        print("[Backend] 🧠 ❌ Failed to extract valid JSON, returning raw response")
        return {
            "response": response_text,
            "status": "success",
            "meta": {"warning": "Could not extract clean JSON array"},
        }

    except Exception as e:
        print(f"[Backend] 🧠 ❌ Memory extraction error: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Memory extraction failed: {str(e)}"
        )


@app.post("/api/memory")
async def memory_proxy(request: Request):
    """Proxy requests to the memory extraction service at memory.geist.im/v1/chat/completions"""
    try:
        # Build the target URL
        target_url = f"{config.MEMORY_EXTRACTION_URL}/v1/chat/completions"
        logger.info(f"Proxying memory request to: {target_url}")

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

        # Forward the request to memory extraction service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                target_url,
                headers=forward_headers,
                content=body,
                timeout=config.MEMORY_EXTRACTION_TIMEOUT,
            )

        logger.info(
            f"Memory extraction service responded with status: {response.status_code}"
        )

        # Return the response with appropriate headers
        response_headers = {}
        for key, value in response.headers.items():
            if key.lower() not in skip_headers:
                response_headers[key] = value

        return StreamingResponse(
            iter([response.content]),
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type"),
        )

    except httpx.ConnectError as e:
        logger.error(
            f"Failed to connect to memory extraction service at {config.MEMORY_EXTRACTION_URL}: {str(e)}"
        )
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to memory extraction service at {config.MEMORY_EXTRACTION_URL}",
        )
    except httpx.TimeoutException as e:
        logger.error(f"Timeout connecting to memory extraction service: {str(e)}")
        raise HTTPException(
            status_code=504,
            detail="Memory extraction service timeout",
        )
    except Exception as e:
        logger.error(f"Error proxying memory extraction request: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Failed to proxy request to memory extraction service",
        )


@app.post("/api/stream")
async def stream_with_orchestrator(chat_request: ChatRequest, request: Request):
    """Enhanced streaming endpoint with orchestrator and sub-agent visibility"""
    
    gpt_service = await get_gpt_service()
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

@app.post("/api/summarize")
async def summarize_conversation(conversation_dict: List[dict]):
    """Summarize text using the orchestrator"""
    summarizer_prompt = get_summarizer_prompt()
    conversation_json = json.dumps(conversation_dict, ensure_ascii=False)
    content = f"{summarizer_prompt}\n\n[CONVERSATION_JSON]:\n{conversation_json}\n"
    conversation_dict = [{"role": "user", "content": content}]
    
    gpt_service = await get_gpt_service()  
    headers, model, url = gpt_service.get_chat_completion_params()
    async with httpx.AsyncClient() as client:
       response = await client.post(
        f"{url}/v1/chat/completions",
        json={
            "messages": conversation_dict,
            "temperature": 1.0,
            "top_p": 1.0,
            "max_tokens": 32767,
            "stream": False,
            "model": model,
            "reasoning_effort": "medium",
        },
        headers=headers,
        timeout=config.INFERENCE_TIMEOUT
    )
    result = response.json()

        # Validate response structure
    if "choices" not in result or not result["choices"]:
        raise ValueError(f"Invalid response from inference service: {result}")
    choice = result["choices"][0]
    return choice["message"]["content"]

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
        logger.info(f"Starting server on {config.API_HOST}:{config.API_PORT}")
        uvicorn.run(app, host=config.API_HOST, port=config.API_PORT, log_level="info")
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        sys.exit(1)


# TEST INFERENCE SERVER CONNECTION
# curl -X POST https://inference.geist.im/v1/chat/completions -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hello how are you"}],"temperature":0.7,"max_tokens":100}'
