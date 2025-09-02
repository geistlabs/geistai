from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
import httpx
import asyncio
import json
import config
from harmony_service import HarmonyService

class HealthCheckResponse(BaseModel):
    status: str

class ChatRequest(BaseModel):
    message: str

app = FastAPI(title="Geist Router")

# Initialize Harmony service if enabled
harmony_service = HarmonyService() if config.HARMONY_ENABLED else None


@app.get("/health")
def health_check():
    return {"status": "healthy ser"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint for backwards compatibility"""
    # Prepare messages for the model
    messages = [{"role": "user", "content": request.message}]
    
    # Process chat request through harmony service
    if harmony_service and config.HARMONY_ENABLED:
        ai_response = await harmony_service.process_chat_request(
            messages, 
            config, 
            reasoning_effort=config.HARMONY_REASONING_EFFORT
        )
    else:
        # Fallback - direct HTTP call without harmony service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.INFERENCE_URL}/v1/chat/completions",
                json={
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 100
                },
                timeout=config.INFERENCE_TIMEOUT
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
    messages = [{"role": "user", "content": chat_request.message}]
    
    async def event_stream():
        chunk_sequence = 0
        try:
            # Stream tokens from harmony service
            async for token in harmony_service.stream_chat_request(
                messages, 
                config, 
                reasoning_effort=config.HARMONY_REASONING_EFFORT
            ):
                # Check if client is still connected
                if await request.is_disconnected():
                    break
                
                # Send token as SSE event (no encryption)
                yield {"data": json.dumps({"token": token, "sequence": chunk_sequence}), "event": "chunk"}
                chunk_sequence += 1
            
            # Send end event
            yield {"data": json.dumps({"finished": True}), "event": "end"}
            
        except asyncio.TimeoutError as e:
            yield {"data": json.dumps({"error": "Request timeout"}), "event": "error"}
        except Exception as e:
            yield {"data": json.dumps({"error": "Internal server error"}), "event": "error"}
    
    return EventSourceResponse(event_stream())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)