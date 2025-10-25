#!/usr/bin/env python3
"""
Test script for the /api/negotiate endpoint
Tests if the negotiation chat works properly without infinite loops
"""

import asyncio
import json
import sys
from datetime import datetime

import httpx

# Configuration
API_URL = "http://localhost:8000"
NEGOTIATE_ENDPOINT = f"{API_URL}/api/negotiate"

def log_with_timestamp(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")

async def test_negotiation_endpoint():
    """Test the /api/negotiate endpoint"""
    log_with_timestamp("🧪 Starting negotiation endpoint test")

    # Test message
    test_message = "Hello, I'm interested in your pricing"

    # Request payload
    payload = {
        "message": test_message,
        "messages": []
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "X-User-ID": "test_user_123"
    }

    log_with_timestamp(f"📤 Sending request to {NEGOTIATE_ENDPOINT}")
    log_with_timestamp(f"📤 Message: {test_message}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                NEGOTIATE_ENDPOINT,
                json=payload,
                headers=headers
            ) as response:

                log_with_timestamp(f"📡 Response status: {response.status_code}")

                if response.status_code != 200:
                    log_with_timestamp(f"❌ Error: {response.status_code}")
                    return False

                # Track events and completion
                event_count = 0
                orchestrator_start_received = False
                orchestrator_complete_received = False
                token_count = 0
                start_time = asyncio.get_event_loop().time()

                log_with_timestamp("📥 Starting to read events...")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue

                    # Parse SSE format
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])  # Remove "data: " prefix
                            event_type = data.get("type", "unknown")
                            event_count += 1

                            log_with_timestamp(f"📨 Event #{event_count}: {event_type}")

                            # Track specific events
                            if event_type == "orchestrator_start":
                                orchestrator_start_received = True
                                log_with_timestamp("✅ Orchestrator started")

                            elif event_type == "orchestrator_token":
                                token_data = data.get("data", {})
                                if token_data.get("channel") == "content":
                                    token_count += 1
                                    token_text = token_data.get("data", "")
                                    log_with_timestamp(f"📝 Token #{token_count}: '{token_text}'")

                            elif event_type == "orchestrator_complete":
                                orchestrator_complete_received = True
                                log_with_timestamp("✅ Orchestrator completed - STREAM SHOULD END")
                                break  # This should end the stream

                            elif event_type == "final_response":
                                orchestrator_complete_received = True
                                log_with_timestamp("✅ Final response received - STREAM SHOULD END")
                                break  # This should end the stream

                            elif event_type == "error":
                                error_data = data.get("data", {})
                                log_with_timestamp(f"❌ Error: {error_data.get('message', 'Unknown error')}")
                                return False

                        except json.JSONDecodeError as e:
                            log_with_timestamp(f"⚠️ Failed to parse JSON: {line[:100]}...")
                            continue

                # Check results
                elapsed_time = asyncio.get_event_loop().time() - start_time
                log_with_timestamp(f"⏱️ Test completed in {elapsed_time:.2f} seconds")
                log_with_timestamp(f"📊 Events received: {event_count}")
                log_with_timestamp(f"📊 Tokens received: {token_count}")
                log_with_timestamp(f"📊 Orchestrator started: {orchestrator_start_received}")
                log_with_timestamp(f"📊 Orchestrator completed: {orchestrator_complete_received}")

                # Success criteria
                if orchestrator_start_received and orchestrator_complete_received and token_count > 0:
                    log_with_timestamp("✅ SUCCESS: Negotiation chat completed properly!")
                    return True
                else:
                    log_with_timestamp("❌ FAILURE: Stream did not complete properly")
                    return False

    except asyncio.TimeoutError:
        log_with_timestamp("❌ FAILURE: Request timed out (infinite loop?)")
        return False
    except Exception as e:
        log_with_timestamp(f"❌ FAILURE: {str(e)}")
        return False

async def main():
    """Main test function"""
    log_with_timestamp("🚀 Starting negotiation endpoint test")

    success = await test_negotiation_endpoint()

    if success:
        log_with_timestamp("🎉 All tests passed!")
        sys.exit(0)
    else:
        log_with_timestamp("💥 Tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
