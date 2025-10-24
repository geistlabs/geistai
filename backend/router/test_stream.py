#!/usr/bin/env python3
"""
Test script for /api/stream endpoint
"""
import requests
import json

def test_stream_endpoint():
    """Test the /api/stream endpoint"""
    url = "http://localhost:8000/api/stream"

    headers = {
        "Content-Type": "application/json",
        "X-User-ID": "test_user_123"
    }

    data = {
        "message": "Hey",
        "messages": []
    }

    print("🧪 Testing /api/stream endpoint...")
    print(f"URL: {url}")
    print(f"Headers: {headers}")
    print(f"Data: {json.dumps(data, indent=2)}")
    print("\n" + "="*50)

    try:
        response = requests.post(url, headers=headers, json=data, stream=True)

        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return

        print("✅ Stream started successfully!")
        print("\n📡 Streaming events:")
        print("-" * 30)

        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                print(f"📨 {line_str}")

                # Parse SSE format
                if line_str.startswith('data: '):
                    try:
                        data_content = line_str[6:]  # Remove 'data: ' prefix
                        parsed = json.loads(data_content)
                        print(f"   📊 Parsed: {json.dumps(parsed, indent=2)}")
                    except json.JSONDecodeError:
                        print(f"   ⚠️  Could not parse JSON: {data_content}")

                # Stop after a few events for testing
                if "orchestrator_complete" in line_str:
                    print("\n✅ Stream completed!")
                    break

    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the backend running on localhost:8000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_stream_endpoint()
