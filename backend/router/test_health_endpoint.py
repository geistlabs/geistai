#!/usr/bin/env python3
"""
Test script for the health endpoint of the router service.
This script tests the /health endpoint and validates its response structure.
"""

import urllib.request
import urllib.error
import json
import sys
import ssl

def test_health_endpoint(base_url="http://localhost:8000", use_ssl=False):
    """Test the health endpoint and validate its response."""
    url = f"{base_url}/health"
    
    print(f"🔍 Testing health endpoint: {url}")
    
    try:
        # Create request
        req = urllib.request.Request(url)
        
        # Create SSL context if needed
        if use_ssl:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
        else:
            ssl_context = None
        
        # Make request
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
            status_code = response.getcode()
            print(f"📊 Status Code: {status_code}")
            
            if status_code == 200:
                try:
                    data = json.loads(response.read().decode('utf-8'))
                    print(f"✅ Health endpoint response:")
                    print(f"   Status: {data.get('status', 'N/A')}")
                    print(f"   SSL Enabled: {data.get('ssl_enabled', 'N/A')}")
                    print(f"   SSL Status: {data.get('ssl_status', 'N/A')}")
                    
                    # Validate response structure
                    required_fields = ['status', 'ssl_enabled', 'ssl_status']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        print(f"❌ Missing required fields: {missing_fields}")
                        return False
                    
                    # Validate status value
                    if data['status'] != 'healthy':
                        print(f"❌ Expected status 'healthy', got '{data['status']}'")
                        return False
                    
                    # Validate SSL enabled is boolean
                    if not isinstance(data['ssl_enabled'], bool):
                        print(f"❌ ssl_enabled should be boolean, got {type(data['ssl_enabled'])}")
                        return False
                    
                    print(f"✅ All validations passed!")
                    return True
                    
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON response: {e}")
                    print(f"   Raw response: {response.read().decode('utf-8')}")
                    return False
            else:
                print(f"❌ Health endpoint returned status {status_code}")
                return False
                
    except urllib.error.URLError as e:
        if "Connection refused" in str(e) or "Name or service not known" in str(e):
            print(f"❌ Connection failed - is the server running on {base_url}?")
        else:
            print(f"❌ URL Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def test_ssl_info_endpoint(base_url="http://localhost:8000", use_ssl=False):
    """Test the SSL info endpoint."""
    url = f"{base_url}/ssl/info"
    
    print(f"\n🔍 Testing SSL info endpoint: {url}")
    
    try:
        # Create request
        req = urllib.request.Request(url)
        
        # Create SSL context if needed
        if use_ssl:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
        else:
            ssl_context = None
        
        # Make request
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
            status_code = response.getcode()
            print(f"📊 Status Code: {status_code}")
            
            if status_code == 200:
                try:
                    data = json.loads(response.read().decode('utf-8'))
                    print(f"✅ SSL info endpoint response:")
                    print(f"   SSL Enabled: {data.get('ssl_enabled', 'N/A')}")
                    print(f"   SSL Valid: {data.get('ssl_valid', 'N/A')}")
                    print(f"   SSL Status: {data.get('ssl_status', 'N/A')}")
                    print(f"   Cert Path: {data.get('cert_path', 'N/A')}")
                    print(f"   Key Path: {data.get('key_path', 'N/A')}")
                    
                    if 'certificate' in data:
                        cert_info = data['certificate']
                        if 'error' in cert_info:
                            print(f"   Certificate Error: {cert_info['error']}")
                        else:
                            print(f"   Certificate Format: {cert_info.get('format', 'N/A')}")
                            print(f"   Certificate Size: {cert_info.get('size_bytes', 'N/A')} bytes")
                    
                    return True
                    
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON response: {e}")
                    return False
            else:
                print(f"❌ SSL info endpoint returned status {status_code}")
                return False
                
    except urllib.error.URLError as e:
        print(f"❌ SSL info endpoint error: {e}")
        return False
    except Exception as e:
        print(f"❌ SSL info endpoint error: {str(e)}")
        return False

def main():
    print("🏥 Health Endpoint Test for Router Service (HTTP Only)")
    print("=" * 60)
    
    # Test HTTP health endpoint
    print("\n📡 Testing HTTP health endpoint:")
    http_success = test_health_endpoint("http://localhost:8000")
    
    # Test HTTP SSL info endpoint
    test_ssl_info_endpoint("http://localhost:8000")
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary:")
    
    if http_success:
        print("✅ HTTP health endpoint: PASSED")
    else:
        print("❌ HTTP health endpoint: FAILED")
    
    print("\n📖 To start the server:")
    print("cd backend/router && python main.py")
    print("or")
    print("docker-compose up router")
    
    return http_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
