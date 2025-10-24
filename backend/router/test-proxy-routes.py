#!/usr/bin/env python3
"""
Test script for the new proxy routes in the router service.
This script tests the /inference/* and /embeddings/* proxy endpoints.
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

    # Test embeddings proxy routes
    print("\n📊 Testing Embedder Service Proxy:")
    test_proxy_endpoint(http_base, "embeddings", "health")
    test_proxy_endpoint(http_base, "embeddings", "models")

    print("\n📊 Testing Embedder Service Proxy (HTTPS):")
    test_proxy_endpoint(https_base, "embeddings", "health", use_ssl=True)

    print("\n" + "=" * 50)
    print("📖 Usage Examples:")
    print("# Direct access to embeddings service:")
    print("curl http://localhost/embeddings/health")
    print("curl http://localhost/embeddings/models")
    print("")
    print("# Generate embeddings:")
    print("curl -X POST http://localhost/embeddings/embeddings \\")
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{"input":"hello world","model":"all-MiniLM-L6-v2"}\'')
    print("")


if __name__ == "__main__":
    main()
