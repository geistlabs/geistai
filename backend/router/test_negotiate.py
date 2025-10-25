#!/usr/bin/env python3
"""
Test script for the /api/negotiate endpoint
"""

import asyncio
import httpx
import json

async def test_negotiate_endpoint():
    """Test the negotiate endpoint with a simple message"""

    # Test data
    test_data = {
        "message": "I'm interested in a subscription plan for my small business. What options do you have?",
        "messages": []
    }

    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "test-user-123"  # Mock user ID for testing
    }

    print("🧪 Testing /api/negotiate endpoint...")
    print(f"📤 Sending request: {test_data['message']}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                "http://localhost:8000/api/negotiate",
                json=test_data,
                headers=headers
            ) as response:

                print(f"📡 Response status: {response.status_code}")
                print(f"📡 Response headers: {dict(response.headers)}")

                if response.status_code != 200:
                    print(f"❌ Error: {response.status_code}")
                    error_text = await response.aread()
                    print(f"Error details: {error_text.decode()}")
                    return

                print("📥 Streaming response:")
                print("-" * 50)

                event_count = 0
                line_count = 0

                async for line in response.aiter_lines():
                    line_count += 1
                    print(f"Line {line_count}: {repr(line)}")

                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])  # Remove "data: " prefix
                            event_count += 1
                            print(f"✅ Event {event_count}: {json.dumps(data, indent=2)}")

                            # Check for completion
                            if data.get("type") == "orchestrator_complete":
                                print("✅ Orchestrator completed successfully")
                                break
                            elif data.get("type") == "error":
                                print(f"❌ Error in stream: {data.get('data', {}).get('message', 'Unknown error')}")
                                break

                        except json.JSONDecodeError as e:
                            print(f"⚠️  JSON decode error: {e} for line: {line}")
                    elif line.strip():
                        print(f"📄 Non-data line: {line}")
                    elif line == "":
                        print("📄 Empty line (event separator)")

                print("-" * 50)
                print(f"✅ Test completed. Received {event_count} events from {line_count} lines.")

    except httpx.TimeoutError:
        print("❌ Request timed out")
    except httpx.ConnectError:
        print("❌ Could not connect to server. Make sure the backend is running on localhost:8000")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(test_negotiate_endpoint())
