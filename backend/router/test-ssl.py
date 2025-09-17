#!/usr/bin/env python3
"""
Test script for SSL configuration in the router service.
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
    print("🔐 SSL Configuration Test for Router Service")
    print("=" * 50)
    
    # Test HTTP endpoint
    print("\n📡 Testing HTTP endpoint (port 8000):")
    http_success = test_endpoint("http://localhost:8000", "/health")
    test_endpoint("http://localhost:8000", "/ssl/info")
    
    # Test HTTPS endpoint
    print("\n🔒 Testing HTTPS endpoint (port 8443):")
    https_success = test_endpoint("https://localhost:8443", "/health", use_ssl=True)
    test_endpoint("https://localhost:8443", "/ssl/info", use_ssl=True)
    
    # Test chat endpoint
    print("\n💬 Testing chat endpoint:")
    try:
        response = requests.post(
            "http://localhost:8000/api/chat",
            json={"message": "Hello, test message"},
            timeout=10
        )
        if response.status_code == 200:
            print("✅ Chat endpoint: Working")
            data = response.json()
            print(f"   Response: {data.get('response', 'No response')[:100]}...")
        else:
            print(f"❌ Chat endpoint: {response.status_code}")
    except Exception as e:
        print(f"❌ Chat endpoint: {str(e)}")
    
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
    print("1. Place your certificate files in backend/router/certificates/")
    print("2. Uncomment SSL configuration in docker-compose.yml")
    print("3. Rebuild and restart: docker-compose up --build")

if __name__ == "__main__":
    main()
