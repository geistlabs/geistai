#!/usr/bin/env python3
"""
Test script to compare /api/stream vs /api/negotiate endpoints
"""
import requests
import json
import time

def test_endpoint(endpoint_name, url, headers, data, max_events=10):
    """Test a single endpoint and capture events"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing {endpoint_name}")
    print(f"URL: {url}")
    print(f"{'='*60}")

    events = []
    start_time = time.time()

    try:
        response = requests.post(url, headers=headers, json=data, stream=True, timeout=30)

        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None

        print("✅ Stream started successfully!")
        print("\n📡 Capturing events:")
        print("-" * 40)

        event_count = 0
        for line in response.iter_lines():
            if line and event_count < max_events:
                line_str = line.decode('utf-8')
                print(f"📨 {line_str}")

                # Parse SSE format
                if line_str.startswith('data: '):
                    try:
                        data_content = line_str[6:]  # Remove 'data: ' prefix
                        parsed = json.loads(data_content)
                        events.append(parsed)
                        event_count += 1

                        # Show event type and key data
                        event_type = parsed.get('type', 'unknown')
                        event_data = parsed.get('data', {})
                        print(f"   📊 Type: {event_type}")
                        if 'agent' in event_data:
                            print(f"   🤖 Agent: {event_data['agent']}")
                        if 'content' in event_data:
                            content = str(event_data['content'])[:50] + "..." if len(str(event_data['content'])) > 50 else str(event_data['content'])
                            print(f"   📝 Content: {content}")
                        print()

                    except json.JSONDecodeError:
                        print(f"   ⚠️  Could not parse JSON: {data_content}")

                # Stop after max_events or completion
                if "orchestrator_complete" in line_str or "agent_complete" in line_str:
                    print("\n✅ Stream completed!")
                    break

    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the backend running on localhost:8000?")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

    end_time = time.time()
    duration = end_time - start_time

    print(f"\n📊 Summary for {endpoint_name}:")
    print(f"   ⏱️  Duration: {duration:.2f}s")
    print(f"   📨 Events captured: {len(events)}")
    print(f"   🎯 Event types: {set(e.get('type') for e in events)}")

    return {
        'endpoint': endpoint_name,
        'duration': duration,
        'events': events,
        'event_types': set(e.get('type') for e in events)
    }

def main():
    """Compare both endpoints"""
    base_url = "http://localhost:8000"

    # Common headers
    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "test_user_123"
    }

    print("🔧 Setting DISABLE_PREMIUM_CHECK=true for testing...")
    import os
    os.environ["DISABLE_PREMIUM_CHECK"] = "true"

    # Test data
    data = {
        "message": "Hey",
        "messages": []
    }

    print("🚀 Starting endpoint comparison test...")
    print(f"Base URL: {base_url}")
    print(f"Test message: {data['message']}")

    # Test /api/stream
    stream_result = test_endpoint(
        "/api/stream",
        f"{base_url}/api/stream",
        headers,
        data,
        max_events=15
    )

    # Test /api/negotiate
    negotiate_result = test_endpoint(
        "/api/negotiate",
        f"{base_url}/api/negotiate",
        headers,
        data,
        max_events=15
    )

    # Compare results
    print(f"\n{'='*60}")
    print("📊 COMPARISON RESULTS")
    print(f"{'='*60}")

    if stream_result and negotiate_result:
        print(f"⏱️  Duration:")
        print(f"   /api/stream: {stream_result['duration']:.2f}s")
        print(f"   /api/negotiate: {negotiate_result['duration']:.2f}s")

        print(f"\n📨 Event counts:")
        print(f"   /api/stream: {len(stream_result['events'])} events")
        print(f"   /api/negotiate: {len(negotiate_result['events'])} events")

        print(f"\n🎯 Event types:")
        print(f"   /api/stream: {stream_result['event_types']}")
        print(f"   /api/negotiate: {negotiate_result['event_types']}")

        # Check for looping
        stream_agent_tokens = [e for e in stream_result['events'] if e.get('type') == 'orchestrator_token']
        negotiate_agent_tokens = [e for e in negotiate_result['events'] if e.get('type') == 'orchestrator_token']

        print(f"\n🔄 Token events:")
        print(f"   /api/stream: {len(stream_agent_tokens)} token events")
        print(f"   /api/negotiate: {len(negotiate_agent_tokens)} token events")

        if len(negotiate_agent_tokens) > 20:
            print("   ⚠️  /api/negotiate has many token events - possible loop!")

    else:
        print("❌ One or both tests failed")

if __name__ == "__main__":
    main()
