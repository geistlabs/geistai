#!/usr/bin/env python3
"""
Test Query Router

Run: python test_router.py
"""

from query_router import route_query

# Test cases
test_cases = {
    # Tool queries (weather, news, search)
    "What's the weather in Paris?": "qwen_tools",
    "Latest news about AI": "qwen_tools",
    "Search for Python tutorials": "qwen_tools",
    "What's happening in the world today?": "qwen_tools",
    "Current temperature in London": "qwen_tools",

    # Creative queries
    "Write a haiku about coding": "gpt_oss",
    "Tell me a joke": "gpt_oss",
    "Create a poem about the ocean": "gpt_oss",
    "Imagine a world without technology": "gpt_oss",

    # Simple explanations
    "What is Docker?": "gpt_oss",
    "Explain quantum physics": "gpt_oss",
    "Define artificial intelligence": "gpt_oss",

    # Code queries
    "Fix this Python code": "qwen_direct",
    "Debug my function": "qwen_direct",
    "Implement a binary search": "qwen_direct",

    # Edge cases
    "What is the latest weather?": "qwen_tools",  # Latest → tools
    "Hello": "gpt_oss",  # Short/simple → GPT-OSS
}

def main():
    print("🧪 Testing Query Router")
    print("=" * 60)
    print()

    passed = 0
    failed = 0

    for query, expected in test_cases.items():
        result = route_query(query)
        status = "✅" if result == expected else "❌"

        if result == expected:
            passed += 1
        else:
            failed += 1

        print(f"{status} Query: '{query}'")
        print(f"   Expected: {expected}")
        print(f"   Got:      {result}")
        print()

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print()

    if failed == 0:
        print("✅ All tests passed!")
        return 0
    else:
        print(f"❌ {failed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
