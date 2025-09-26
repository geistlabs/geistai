#!/usr/bin/env python3
"""
Test script for health endpoint functionality.
"""

import httpx
import asyncio
import sys

async def test_health_endpoint():
    """Test the health endpoint"""
    url = "http://localhost:8000/health"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            print(f"Health check status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health check passed: {data}")
                return True
            else:
                print(f"❌ Health check failed: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

if __name__ == "__main__":
    print("🏥 Testing health endpoint...")
    success = asyncio.run(test_health_endpoint())
    sys.exit(0 if success else 1)