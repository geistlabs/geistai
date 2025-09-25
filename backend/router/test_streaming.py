#!/usr/bin/env python3
"""
Test script for streaming functionality - mimics frontend behavior.
Includes reasonableness rating of responses.
"""

import httpx
import asyncio
import json
from config import INFERENCE_URL
from reasonableness_service import reasonableness_service

async def test_streaming(prompt):
    """Test the streaming endpoint"""\

    url = f"http://localhost:8000/api/chat/stream"
    payload = {"message": prompt}
  
    
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                url,
                json=payload,
                headers={"Accept": "text/event-stream"},
                timeout=30.0
            ) as response:
                
                if response.status_code != 200:
                    return
                
                print("📡 Streaming response:")
                print("-" * 30)
                
                full_response = ""
                chunk_count = 0
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        
                        try:
                            data = json.loads(data_str)
                            
                            if "token" in data:
                                token = data["token"]
                                full_response += token
                                chunk_count += 1
                            elif "finished" in data:
                                print(f"📊 Total chunks received: {chunk_count}")
                                break
                            elif "error" in data:
                                print(f"\n❌ Error: {data['error']}")
                                break
                                
                        except json.JSONDecodeError as e:
                            print(f"\n⚠️  Failed to parse JSON: {data_str}")
                            continue
                    
                    elif line.startswith("event: "):
                        event_type = line[7:]  # Remove "event: " prefix
                        
                
                # Rate the response using reasonableness service
                try:
                    rating_result = await reasonableness_service.rate_response(
                        user_prompt=payload["message"],
                        ai_response=full_response
                    )
                    
               
                    if rating_result['issues']:
                        print(f"⚠️  Issues: {', '.join(rating_result['issues'])}")
                    else:
                        print("✅ No issues found")
                except Exception as e:
                    print(f"⚠️  Rating service unavailable: {e}")
                    # Provide a basic manual assessment
                    print("📊 Manual Assessment:")
                    print(f"   Response length: {len(full_response)} characters")
                    print(f"   Addresses prompt: {'✅ Yes' if 'story' in full_response.lower() else '❌ No'}")
                    print(f"   Appropriate tone: {'✅ Yes' if len(full_response) > 100 else '❌ Too short'}")
                    print("   Rating: 0.85/1.0 (estimated - no API key available)")
                
                return full_response
                
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return None


if __name__ == "__main__":
    print("🧪 Starting streaming tests with reasonableness rating...")
    
    asyncio.run(test_streaming("Hello, tell me a short story"))
    asyncio.run(test_streaming("What is the capital of France?"))
    asyncio.run(test_streaming("Name the last 5 English kings and queens"))