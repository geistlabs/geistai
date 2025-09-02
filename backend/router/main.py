from fastapi import FastAPI
from pydantic import BaseModel
import httpx
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)