#!/usr/bin/env python3
"""
Test both /api/stream and /api/negotiate endpoints to verify channel handling is fixed
"""
import requests
import json
import time
from datetime import datetime

def test_endpoint(url, name, headers=None):
    """Test a single endpoint"""
    if headers is None:
        headers = {
            "Content-Type": "application/json",
            "X-User-ID": "test_user_123"
        }

    data = {
        "message": "Hey",
        "messages": []
    }

    print(f"🧪 Testing {name}")
    print(f"URL: {url}")
    print("=" * 60)

    try:
        response = requests.post(url, headers=headers, json=data, stream=True, timeout=30)

        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False

        print("✅ Stream started successfully!")
        print("\n📡 Capturing events:")
        print("-" * 40)

        events = []
        start_time = time.time()
        channels = set()

        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')

                if line_str.startswith('data: '):
                    try:
                        json_data = line_str[6:]
                        event_data = json.loads(json_data)
                        events.append(event_data)

                        event_type = event_data.get('type', 'unknown')
                        print(f"📨 event: {event_type}")

                        # Check for channel information
                        if 'data' in event_data:
                            data_content = event_data['data']
                            if isinstance(data_content, dict):
                                if 'channel' in data_content:
                                    channel = data_content['channel']
                                    content = data_content.get('data', '')
                                    channels.add(channel)
                                    print(f"   📝 Channel: {channel} | Content: '{content}'")
                                elif 'content' in data_content and isinstance(data_content['content'], dict):
                                    content_info = data_content['content']
                                    if 'channel' in content_info:
                                        channel = content_info['channel']
                                        content = content_info.get('data', '')
                                        channels.add(channel)
                                        print(f"   📝 Channel: {channel} | Content: '{content}'")

                    except json.JSONDecodeError as e:
                        print(f"⚠️  JSON decode error: {e}")
                    except Exception as e:
                        print(f"⚠️  Parse error: {e}")

        duration = time.time() - start_time

        print(f"\n📊 Summary for {name}:")
        print(f"   ⏱️  Duration: {duration:.2f}s")
        print(f"   📨 Events captured: {len(events)}")
        print(f"   🎯 Channels found: {channels}")

        # Check for completion events
        completion_events = [e for e in events if e.get('type') in ['orchestrator_complete', 'agent_complete', 'final_response']]
        print(f"   ✅ Completion events: {len(completion_events)}")

        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Test both endpoints"""
    base_url = "http://localhost:8000"

    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "test_user_123"
    }

    print("🚀 Testing FIXED endpoints...")
    print("Base URL:", base_url)
    print("Message: Hey")
    print("=" * 60)

    # Test /api/stream
    stream_success = test_endpoint(f"{base_url}/api/stream", "/api/stream", headers)

    print("\n" + "=" * 60)

    # Test /api/negotiate
    negotiate_success = test_endpoint(f"{base_url}/api/negotiate", "/api/negotiate", headers)

    print("\n" + "=" * 60)
    print("📊 COMPARISON RESULTS")
    print("=" * 60)

    if stream_success and negotiate_success:
        print("✅ Both endpoints working!")
    else:
        print("❌ One or both endpoints failed")

    print(f"   /api/stream: {'✅' if stream_success else '❌'}")
    print(f"   /api/negotiate: {'✅' if negotiate_success else '❌'}")

if __name__ == "__main__":
    main()
