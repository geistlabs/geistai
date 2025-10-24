#!/usr/bin/env python3
"""
Test script for pricing negotiation functionality
"""

import os
import sys
import asyncio
from typing import Dict, Any

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_pricing_agent():
    """Test the pricing agent creation and basic functionality"""
    try:
        print("🧪 Testing pricing agent...")

        # Test RevenueCat auth import
        from revenuecat_auth import revenuecat_auth
        print("✅ RevenueCat auth imported successfully")

        # Test pricing agent creation
        from agent_tool import create_pricing_agent
        agent = create_pricing_agent()
        print(f"✅ Pricing agent created: {agent.name}")
        print(f"   Description: {agent.description}")
        print(f"   Reasoning effort: {agent.reasoning_effort}")

        # Test agent system prompt
        print(f"   System prompt length: {len(agent.system_prompt)} characters")
        print(f"   System prompt preview: {agent.system_prompt[:200]}...")

        return True

    except Exception as e:
        print(f"❌ Error testing pricing agent: {e}")
        return False

async def test_revenuecat_auth():
    """Test RevenueCat authentication functionality"""
    try:
        print("🧪 Testing RevenueCat auth...")

        from revenuecat_auth import revenuecat_auth

        # Test with mock user ID
        test_user_id = "test_user_123"
        print(f"   Testing with user ID: {test_user_id}")

        # This should work even without API key (returns mock data)
        result = await revenuecat_auth.verify_user_premium(test_user_id)
        print(f"✅ Premium verification result: {result}")

        return True

    except Exception as e:
        print(f"❌ Error testing RevenueCat auth: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Starting pricing negotiation tests...\n")

    tests = [
        ("RevenueCat Auth", test_revenuecat_auth),
        ("Pricing Agent", test_pricing_agent),
    ]

    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"Running: {test_name}")
        print('='*50)

        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))

    print(f"\n{'='*50}")
    print("TEST RESULTS")
    print('='*50)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")

    all_passed = all(result for _, result in results)
    print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")

    return all_passed

if __name__ == "__main__":
    asyncio.run(main())
