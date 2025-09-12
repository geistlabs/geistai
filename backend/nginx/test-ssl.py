#!/usr/bin/env python3
"""
Test script for the nginx reverse proxy SSL configuration.
This script tests routing to both inference and embedder services.
"""

import requests
import json
import sys
import time
from urllib3.exceptions import InsecureRequestWarning

# Suppress SSL warnings for self-signed certificates
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


def test_endpoint(base_url, endpoint="/health", use_ssl=False, service_name=""):
    """Test an endpoint with optional SSL."""
    url = f"{base_url}{endpoint}"

    try:
        if use_ssl:
            response = requests.get(url, verify=False, timeout=10)
        else:
            response = requests.get(url, timeout=10)

        print(f"✅ {service_name} {endpoint}: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
            except:
                print(f"   Response: {response.text[:100]}...")
        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ {service_name} {endpoint}: {str(e)}")
        return False


def test_inference_functionality(base_url, use_ssl=False):
    """Test inference service functionality."""
    print(f"\n🧠 Testing inference service functionality:")

    # Test model info
    test_endpoint(base_url, "/v1/models", use_ssl, "Inference")

    # Test simple completion
    print(f"\n💬 Testing inference completion:")
    try:
        response = requests.post(
            f"{base_url}/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hello! Say hi back."}],
                "max_tokens": 10,
                "temperature": 0.7,
            },
            verify=False if use_ssl else True,
            timeout=30,
        )
        if response.status_code == 200:
            print("✅ Inference completion: Working")
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                print(f"   Response: {content[:100]}...")
            print(f"   Model: {data.get('model', 'unknown')}")
        else:
            print(f"❌ Inference completion: {response.status_code}")
            print(f"   Error: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ Inference completion: {str(e)}")


def test_embedder_functionality(base_url, use_ssl=False):
    """Test embedder service functionality."""
    print(f"\n📊 Testing embedder service functionality:")

    # Test models endpoint
    test_endpoint(base_url, "/models", use_ssl, "Embedder")

    # Test embedding generation
    print(f"\n🔢 Testing embedding generation:")
    try:
        response = requests.post(
            f"{base_url}/embed",
            json={"input": "Hello, test embedding", "model": "all-MiniLM-L6-v2"},
            verify=False if use_ssl else True,
            timeout=30,
        )
        if response.status_code == 200:
            print("✅ Embedding generation: Working")
            data = response.json()
            if "data" in data and len(data["data"]) > 0:
                embedding_length = len(data["data"][0]["embedding"])
                print(f"   Generated embedding with {embedding_length} dimensions")
            print(f"   Model: {data.get('model', 'unknown')}")
            print(f"   Usage: {data.get('usage', {})}")
        else:
            print(f"❌ Embedding generation: {response.status_code}")
            print(f"   Error: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ Embedding generation: {str(e)}")


def main():
    print("🌐 Nginx Reverse Proxy SSL Test")
    print("=" * 40)

    # Test inference service
    print("\n🧠 Testing Inference Service (inference.geist.im)")
    print("-" * 50)

    # HTTP
    print("\n📡 HTTP (port 80):")
    inference_http = test_endpoint(
        "http://inference.geist.im", "/health", False, "Inference"
    )
    test_endpoint("http://inference.geist.im", "/ssl/info", False, "Inference")
    if inference_http:
        test_inference_functionality("http://inference.geist.im")

    # HTTPS
    print("\n🔒 HTTPS (port 443):")
    inference_https = test_endpoint(
        "https://inference.geist.im", "/health", True, "Inference"
    )
    test_endpoint("https://inference.geist.im", "/ssl/info", True, "Inference")
    if inference_https:
        test_inference_functionality("https://inference.geist.im", use_ssl=True)

    # Test embedder service
    print("\n\n📊 Testing Embedder Service (embedder.geist.im)")
    print("-" * 50)

    # HTTP
    print("\n📡 HTTP (port 80):")
    embedder_http = test_endpoint(
        "http://embedder.geist.im", "/health", False, "Embedder"
    )
    if embedder_http:
        test_embedder_functionality("http://embedder.geist.im")

    # HTTPS
    print("\n🔒 HTTPS (port 443):")
    embedder_https = test_endpoint(
        "https://embedder.geist.im", "/health", True, "Embedder"
    )
    if embedder_https:
        test_embedder_functionality("https://embedder.geist.im", use_ssl=True)

    # Summary
    print("\n" + "=" * 40)
    print("📊 Test Summary:")

    if inference_http:
        print("✅ Inference HTTP service is working")
    else:
        print("❌ Inference HTTP service is not responding")

    if inference_https:
        print("✅ Inference HTTPS service is working")
    else:
        print("❌ Inference HTTPS service is not responding (normal if SSL disabled)")

    if embedder_http:
        print("✅ Embedder HTTP service is working")
    else:
        print("❌ Embedder HTTP service is not responding")

    if embedder_https:
        print("✅ Embedder HTTPS service is working")
    else:
        print("❌ Embedder HTTPS service is not responding (normal if SSL disabled)")

    print("\n📖 Architecture:")
    print("   nginx (SSL termination) routes:")
    print("   - inference.geist.im → inference-server:8080")
    print("   - embedder.geist.im → embedder-server:8001")


if __name__ == "__main__":
    main()
