#!/usr/bin/env python3
"""
Test script for SSL configuration in the embedder service.
This script tests both HTTP and HTTPS endpoints.
"""

import requests
import json
import sys
import time
from urllib3.exceptions import InsecureRequestWarning

# Suppress SSL warnings for self-signed certificates
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


def test_endpoint(base_url, endpoint="/health", use_ssl=False):
    """Test an endpoint with optional SSL."""
    url = f"{base_url}{endpoint}"

    try:
        if use_ssl:
            response = requests.get(url, verify=False, timeout=5)
        else:
            response = requests.get(url, timeout=5)

        print(f"✅ {endpoint}: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ {endpoint}: {str(e)}")
        return False


def main():
    print("🔐 SSL Configuration Test for Embedder Service")
    print("=" * 50)

    # Test HTTP endpoint
    print("\n📡 Testing HTTP endpoint (port 8001):")
    http_success = test_endpoint("http://localhost:8001", "/health")
    test_endpoint("http://localhost:8001", "/ssl/info")
    test_endpoint("http://localhost:8001", "/models")

    # Test HTTPS endpoint
    print("\n🔒 Testing HTTPS endpoint (port 8443):")
    https_success = test_endpoint("https://localhost:8443", "/health", use_ssl=True)
    test_endpoint("https://localhost:8443", "/ssl/info", use_ssl=True)
    test_endpoint("https://localhost:8443", "/models", use_ssl=True)

    # Test embedding endpoint
    print("\n📊 Testing embedding endpoint:")
    try:
        response = requests.post(
            "http://localhost:8001/embed",
            json={"input": "Hello, test message", "model": "all-MiniLM-L6-v2"},
            timeout=10,
        )
        if response.status_code == 200:
            print("✅ Embedding endpoint: Working")
            data = response.json()
            print(f"   Generated {len(data['data'])} embedding(s)")
            print(f"   Model: {data['model']}")
            print(f"   Usage: {data['usage']}")
        else:
            print(f"❌ Embedding endpoint: {response.status_code}")
    except Exception as e:
        print(f"❌ Embedding endpoint: {str(e)}")

    print("\n" + "=" * 50)
    if http_success:
        print("✅ HTTP service is running correctly")
    else:
        print("❌ HTTP service is not responding")

    if https_success:
        print("✅ HTTPS service is running correctly")
    else:
        print("❌ HTTPS service is not responding (this is normal if SSL is disabled)")

    print("\n📖 To enable SSL:")
    print("1. Place your certificate files in backend/embedder/certificates/")
    print("2. Run with SSL configuration:")
    print("   docker run -d \\")
    print("     --name embedder-server \\")
    print("     -p 80:8001 \\")
    print("     -p 443:8443 \\")
    print("     -e SSL_ENABLED=true \\")
    print("     -e API_PORT=8443 \\")
    print("     -v /path/to/certificates:/app/certificates:ro \\")
    print("     alo42/embedder:latest")


if __name__ == "__main__":
    main()
