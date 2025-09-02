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

def parse_harmony_channels(response_text):
    """
    Parse Harmony channel markers - exact copy of reference decode_harmony_response.py logic.
    """
    current_channel = None
    channels = {
        'final': [],
        'analysis': [],
        'commentary': []
    }
    
    def parse_harmony_content(content):
        """Parse Harmony special tokens and channel content."""
        nonlocal current_channel
        # Look for channel markers
        if content == '<|channel|>':
            return 'channel_marker', content
        elif content in ['final', 'analysis', 'commentary']:
            current_channel = content
            return 'channel_name', content
        elif content == '<|message|>':
            return 'message_marker', content
        elif content in ['<|start|>', '<|end|>', '<|return|>']:
            return 'control_token', content
        else:
            return 'content', content
    
    def add_content(content):
        """Add content to the appropriate channel."""
        token_type, token_content = parse_harmony_content(content)
        
        if token_type == 'content' and current_channel:
            channels[current_channel].append(token_content)
        
        return token_type, token_content
    
    # Process tokens like reference
    import re
    tokens = re.split(r'(<\|[^|]+\|>)', response_text)
    
    for token in tokens:
        if token.strip():
            add_content(token)
    
    # Return final channel content like reference get_final_response()
    final_content = ''.join(channels['final'])
    if final_content:
        return final_content
    
    # Fallback to analysis like reference
    analysis_content = ''.join(channels['analysis'])
    return analysis_content if analysis_content else response_text

@app.get("/health")
def health_check():
    return {"status": "healthy ser"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    # Prepare messages for the model
    messages = [{"role": "user", "content": request.message}]
    
    # Use Harmony if enabled and available
    if harmony_service and config.HARMONY_ENABLED and harmony_service.enabled:
        # Prepare conversation with Harmony encoding
        harmony_tokens = harmony_service.prepare_conversation(
            messages,
            reasoning_effort=config.HARMONY_REASONING_EFFORT
        )
        
        # Convert tokens to text prompt for completion endpoint
        harmony_prompt = harmony_service.encoding.decode(harmony_tokens)
        
        # Use completion endpoint for Harmony
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.INFERENCE_URL}/v1/completions",
                json={
                    "prompt": harmony_prompt,
                    "temperature": 0.7,
                    "max_tokens": 100,
                    "stream": False
                },
                timeout=config.INFERENCE_TIMEOUT
            )
        
        # Parse the response
        result = response.json()
        raw_response = result.get("choices", [{}])[0].get("text", "")
        
        # Parse Harmony format to extract final message
        parsed = harmony_service.parse_completion_response(raw_response)
        ai_response = parsed["final"] if parsed["final"] else raw_response
        
    else:
        # Standard chat completions (non-Harmony)
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
        ai_response = result["choices"][0]["message"]["content"]
        
        # Parse GPT-OSS Harmony channels (based on reference decoder)
        ai_response = parse_harmony_channels(ai_response)
    
    return {"response": ai_response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)