#!/usr/bin/env python3
"""
Test /api/stream endpoint on master branch to check channel behavior
"""
import requests
import json
import time
from datetime import datetime

def test_stream_endpoint():
    """Test the /api/stream endpoint"""
    base_url = "http://localhost:8000"

    # Headers
    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "test_user_123"
    }

    # Test data
    data = {
        "message": "Hey",
        "messages": []
    }

    print("🚀 Testing /api/stream on MASTER branch...")
    print(f"URL: {base_url}/api/stream")
    print(f"Message: {data['message']}")
    print("=" * 60)

    try:
        # Make the request
        response = requests.post(
            f"{base_url}/api/stream",
            headers=headers,
            json=data,
            stream=True,
            timeout=30
        )

        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False

        print("✅ Stream started successfully!")
        print("\n📡 Capturing events:")
        print("-" * 40)

        events = []
        start_time = time.time()

        # Process the stream
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')

                if line_str.startswith('data: '):
                    try:
                        # Parse the JSON data
                        json_data = line_str[6:]  # Remove 'data: ' prefix
                        event_data = json.loads(json_data)

                        events.append(event_data)

                        # Print event details
                        event_type = event_data.get('type', 'unknown')
                        print(f"📨 event: {event_type}")

                        if 'data' in event_data:
                            data_content = event_data['data']
                            if isinstance(data_content, dict):
                                if 'channel' in data_content:
                                    channel = data_content['channel']
                                    content = data_content.get('data', '')
                                    print(f"   📝 Channel: {channel} | Content: '{content}'")
                                elif 'content' in data_content and isinstance(data_content['content'], dict):
                                    content_info = data_content['content']
                                    if 'channel' in content_info:
                                        channel = content_info['channel']
                                        content = content_info.get('data', '')
                                        print(f"   📝 Channel: {channel} | Content: '{content}'")
                                else:
                                    print(f"   📊 Data: {data_content}")

                    except json.JSONDecodeError as e:
                        print(f"⚠️  JSON decode error: {e}")
                        print(f"   Raw line: {line_str}")
                    except Exception as e:
                        print(f"⚠️  Parse error: {e}")
                        print(f"   Raw line: {line_str}")

        duration = time.time() - start_time

        # Summary
        print(f"\n📊 Summary for /api/stream (MASTER):")
        print(f"   ⏱️  Duration: {duration:.2f}s")
        print(f"   📨 Events captured: {len(events)}")

        # Analyze channels
        channels = set()
        for event in events:
            if event.get('type') == 'orchestrator_token':
                data_content = event.get('data', {})
                if isinstance(data_content, dict):
                    if 'channel' in data_content:
                        channels.add(data_content['channel'])
                    elif 'content' in data_content and isinstance(data_content['content'], dict):
                        content_info = data_content['content']
                        if 'channel' in content_info:
                            channels.add(content_info['channel'])

        print(f"   🎯 Channels found: {channels}")

        # Check for completion events
        completion_events = [e for e in events if e.get('type') in ['orchestrator_complete', 'agent_complete']]
        print(f"   ✅ Completion events: {len(completion_events)}")

        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing /api/stream on MASTER branch")
    print("=" * 60)

    success = test_stream_endpoint()

    print("\n" + "=" * 60)
    if success:
        print("✅ Test completed successfully")
    else:
        print("❌ Test failed")
