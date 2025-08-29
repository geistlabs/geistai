from fastapi import FastAPI
from pydantic import BaseModel
import httpx

class HealthCheckResponse(BaseModel):
    status: str

class ChatRequest(BaseModel):
    message: str

app = FastAPI(title="Geist Router")

@app.get("/health")
def health_check():
    return {"status": "healthy ser"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
      # Call the llama.cpp server
      async with httpx.AsyncClient() as client:
          response = await client.post(
              "http://localhost:8080/v1/chat/completions",
              json={
                  "messages": [{"role": "user", "content": request.message}],
                  "temperature": 0.7,
                  "max_tokens": 100
              },
              timeout=30.0
          )

      # Return the AI's response
      result = response.json()
      ai_response = result["choices"][0]["message"]["content"]

      # Clean up GPT-OSS response format
      if "<|message|>" in ai_response and "final" in ai_response:
          # Extract just the final message
          parts = ai_response.split("<|message|>")
          final_part = parts[-1] if parts else ai_response
          ai_response = final_part.strip()

      return {"response": ai_response}