#!/usr/bin/env python3
"""
Test script for streaming functionality - mimics frontend behavior.
"""

import httpx
import asyncio
import json

async def test_streaming():
    """Test the streaming endpoint"""
    url = "http://localhost:8000/api/chat/stream"
    payload = {"message": "Hello, tell me a short story"}
    
    print("🚀 Testing streaming endpoint...")
    print(f"URL: {url}")
    print(f"Payload: {payload}")
    print("\n" + "="*50)
    
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                url,
                json=payload,
                headers={"Accept": "text/event-stream"},
                timeout=30.0
            ) as response:
                print(f"Response status: {response.status_code}")
                
                if response.status_code != 200:
                    print(f"Error: {await response.atext()}")
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
                                sequence = data["sequence"]
                                print(f"[{sequence:03d}] {token}", end="", flush=True)
                                full_response += token
                                chunk_count += 1
                            elif "finished" in data:
                                print(f"\n\n✅ Streaming complete!")
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
                        print(f"\n🔔 Event: {event_type}")
                
                print(f"\n\n📝 Full response:\n{full_response}")
                
    except Exception as e:
        print(f"❌ Test failed: {e}")

async def test_non_streaming():
    """Test the non-streaming endpoint for comparison"""
    url = "http://localhost:8000/api/chat"
    payload = {"message": "Hello, tell me a short story"}
    
    print("\n" + "="*50)
    print("🔍 Testing non-streaming endpoint for comparison...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30.0)
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"📄 Non-streaming response:\n{result['response']}")
            else:
                print(f"❌ Error: {response.text}")
                
    except Exception as e:
        print(f"❌ Non-streaming test failed: {e}")

if __name__ == "__main__":
    print("🧪 Starting streaming tests...")
    
    asyncio.run(test_streaming())
    asyncio.run(test_non_streaming())
    
    print("\n✨ Tests completed!")