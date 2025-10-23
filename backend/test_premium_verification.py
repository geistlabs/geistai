#!/usr/bin/env python3
"""
Test script for RevenueCat premium verification.
Run this to test the server-side premium verification.
"""

import asyncio
import httpx
import json

# Test configuration
API_BASE_URL = "http://localhost:8000"
TEST_USER_ID = "$RCAnonymousID:test_user_123"  # Non-premium user
PREMIUM_USER_ID = "$RCAnonymousID:premium_user_456"  # Premium user (if exists)

async def test_endpoint(endpoint: str, user_id: str = None, expected_status: int = 200):
    """Test an endpoint with or without user ID header"""
    headers = {"Content-Type": "application/json"}
    if user_id:
        headers["X-User-ID"] = user_id

    async with httpx.AsyncClient() as client:
        try:
            if endpoint == "/api/stream":
                response = await client.post(
                    f"{API_BASE_URL}{endpoint}",
                    headers=headers,
                    json={"message": "Hello, test message"},
                    timeout=10.0
                )
            elif endpoint == "/api/speech-to-text":
                # Skip file upload test for now
                print(f"⏭️  Skipping {endpoint} (requires file upload)")
                return
            elif endpoint == "/embeddings/embed":
                response = await client.post(
                    f"{API_BASE_URL}{endpoint}",
                    headers=headers,
                    json={"text": "Test text for embedding"},
                    timeout=10.0
                )
            else:
                response = await client.get(f"{API_BASE_URL}{endpoint}", headers=headers, timeout=10.0)

            status_emoji = "✅" if response.status_code == expected_status else "❌"
            print(f"{status_emoji} {endpoint} - Status: {response.status_code} (Expected: {expected_status})")

            if response.status_code != expected_status:
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text[:100]}")

        except httpx.TimeoutException:
            print(f"⏰ {endpoint} - Timeout")
        except Exception as e:
            print(f"❌ {endpoint} - Error: {str(e)}")

async def run_tests():
    """Run all premium verification tests"""
    print("🧪 Testing RevenueCat Premium Verification")
    print("=" * 50)

    # Test 1: No user ID header (should fail with 401)
    print("\n1️⃣ Testing without X-User-ID header:")
    await test_endpoint("/api/stream", expected_status=401)
    await test_endpoint("/embeddings/embed", expected_status=401)

    # Test 2: Non-premium user (should fail with 403)
    print(f"\n2️⃣ Testing with non-premium user ({TEST_USER_ID}):")
    await test_endpoint("/api/stream", TEST_USER_ID, expected_status=403)
    await test_endpoint("/embeddings/embed", TEST_USER_ID, expected_status=403)

    # Test 3: Health endpoint (should work without premium)
    print(f"\n3️⃣ Testing health endpoint (should work without premium):")
    await test_endpoint("/health", expected_status=200)

    # Test 4: Premium user (should work if user exists in RevenueCat)
    print(f"\n4️⃣ Testing with premium user ({PREMIUM_USER_ID}):")
    print("   Note: This will only work if the user exists in RevenueCat with premium")
    await test_endpoint("/api/stream", PREMIUM_USER_ID, expected_status=200)
    await test_endpoint("/embeddings/embed", PREMIUM_USER_ID, expected_status=200)

    print("\n" + "=" * 50)
    print("✅ Premium verification tests completed!")
    print("\n📝 Next steps:")
    print("1. Add your RevenueCat API key to backend/.env")
    print("2. Test with real premium user IDs from your app")
    print("3. Update frontend to use the new API helper")

if __name__ == "__main__":
    asyncio.run(run_tests())
