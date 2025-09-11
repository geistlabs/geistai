#!/usr/bin/env python3
"""
Test script for the new proxy routes in the router service.
This script tests the /inference/* and /embedder/* proxy endpoints.
"""

import requests
import json
import sys
import time
from urllib3.exceptions import InsecureRequestWarning

# Suppress SSL warnings for self-signed certificates
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


def test_proxy_endpoint(base_url, proxy_path, target_endpoint, use_ssl=False):
    """Test a proxy endpoint."""
    url = f"{base_url}/{proxy_path}/{target_endpoint}"

    try:
        if use_ssl:
            response = requests.get(url, verify=False, timeout=10)
        else:
            response = requests.get(url, timeout=10)

        print(f"✅ {proxy_path}/{target_endpoint}: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
            except:
                print(f"   Response: {response.text[:100]}...")
        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ {proxy_path}/{target_endpoint}: {str(e)}")
        return False


def main():
    print("🔗 Proxy Routes Test for Router Service")
    print("=" * 50)

    # Test HTTP endpoints
    print("\n📡 Testing HTTP proxy endpoints (port 80):")
    http_base = "http://localhost"

    # Test embedder proxy routes
    print("\n📊 Testing Embedder Service Proxy:")
    test_proxy_endpoint(http_base, "embedder", "health")
    test_proxy_endpoint(http_base, "embedder", "models")

    # Test HTTPS endpoints if SSL is enabled
    print("\n🔒 Testing HTTPS proxy endpoints (port 443):")
    https_base = "https://localhost"

    print("\n📊 Testing Embedder Service Proxy (HTTPS):")
    test_proxy_endpoint(https_base, "embedder", "health", use_ssl=True)

    print("\n" + "=" * 50)
    print("📖 Usage Examples:")
    print("# Direct access to embedder service:")
    print("curl http://localhost/embedder/health")
    print("curl http://localhost/embedder/models")
    print("")
    print("# Generate embeddings:")
    print("curl -X POST http://localhost/embedder/embeddings \\")
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{"input":"hello world","model":"all-MiniLM-L6-v2"}\'')
    print("")
    print("# With SSL enabled:")
    print("curl -k https://localhost/embedder/health")
    print("curl -k https://localhost/embedder/embeddings")


if __name__ == "__main__":
    main()
