#!/usr/bin/env python3
"""
Stress Test: Edge Cases and Tool Combinations

Focused tests for the most challenging scenarios that could break
the multi-model architecture or cause routing issues.
"""

import asyncio
import httpx
import json
import time
from typing import List, Dict, Any


class StressTestEdgeCases:
    """Stress test for edge cases and complex scenarios"""

    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
        self.session = None

    async def __aenter__(self):
        self.session = httpx.AsyncClient(timeout=120.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()

    async def test_ambiguous_routing(self):
        """Test queries that could be routed multiple ways"""
        print("\n🎯 Testing Ambiguous Routing")
        print("-" * 40)

        ambiguous_tests = [
            {
                "query": "How's the weather today?",
                "description": "Could be conversation or tool query",
                "expected": "llama"  # Simple conversation
            },
            {
                "query": "What's the weather like right now?",
                "description": "Explicit current weather request",
                "expected": "qwen_tools"  # Needs tools
            },
            {
                "query": "Tell me about the weather",
                "description": "General weather discussion",
                "expected": "llama"  # Conversational
            },
            {
                "query": "Check the current weather in Paris",
                "description": "Explicit weather check",
                "expected": "qwen_tools"  # Needs tools
            },
            {
                "query": "What's happening today?",
                "description": "Ambiguous current events",
                "expected": "qwen_tools"  # Needs current info
            },
            {
                "query": "How's your day going?",
                "description": "Simple conversation",
                "expected": "llama"  # Conversational
            },
            {
                "query": "What's the news today?",
                "description": "Current news request",
                "expected": "qwen_tools"  # Needs tools
            },
            {
                "query": "What's new with you?",
                "description": "Conversational question",
                "expected": "llama"  # Simple chat
            }
        ]

        for test in ambiguous_tests:
            await self._run_single_test(
                test["query"],
                test["expected"],
                test["description"]
            )
            await asyncio.sleep(1)

    async def test_tool_chain_complexity(self):
        """Test complex tool chains and combinations"""
        print("\n🔗 Testing Tool Chain Complexity")
        print("-" * 40)

        complex_tests = [
            {
                "query": "What's the weather in Tokyo, the latest news from Japan, and search for Japanese restaurants in NYC",
                "description": "Multi-location, multi-tool query"
            },
            {
                "query": "Find the latest AI news, check weather in Silicon Valley, and write a haiku about technology",
                "description": "News + Weather + Creative combination"
            },
            {
                "query": "Search for Python tutorials, fetch the best one, and also check the weather in San Francisco",
                "description": "Search + Fetch + Weather combination"
            },
            {
                "query": "What happened in the world yesterday and what's the weather forecast for tomorrow in New York",
                "description": "Historical + Future weather combination"
            },
            {
                "query": "Compare the weather between London, Paris, and Berlin, then tell me a joke about rain",
                "description": "Multi-location comparison + Creative"
            },
            {
                "query": "Find news about climate change, check current temperatures in major cities, and explain global warming",
                "description": "News + Weather + Explanation combination"
            }
        ]

        for test in complex_tests:
            await self._run_single_test(
                test["query"],
                "qwen_tools",  # All should use tools
                test["description"]
            )
            await asyncio.sleep(2)

    async def test_context_switching(self):
        """Test rapid context switching between different types of queries"""
        print("\n🔄 Testing Context Switching")
        print("-" * 40)

        # Simulate a real conversation with rapid topic changes
        conversation_steps = [
            ("Hi there!", "llama", "Simple greeting"),
            ("What's the weather like?", "llama", "Conversational weather"),
            ("Actually, what's the current weather in Tokyo?", "qwen_tools", "Tool weather query"),
            ("Thanks! Now tell me a joke", "llama", "Switch to creative"),
            ("What's the latest news?", "qwen_tools", "Switch to news"),
            ("That's interesting. How are you?", "llama", "Back to conversation"),
            ("Can you debug this Python code: print('hello world')", "qwen_direct", "Switch to code"),
            ("Thanks! What's the weather in London?", "qwen_tools", "Back to tools"),
            ("Write a poem about coding", "llama", "Back to creative"),
            ("What's happening in the world today?", "qwen_tools", "Back to tools")
        ]

        messages = []
        for i, (query, expected_route, description) in enumerate(conversation_steps, 1):
            test_name = f"Context Switch {i}: {description}"
            await self._run_single_test_with_history(
                query, expected_route, messages, test_name
            )

            # Add to conversation history
            messages.append({"role": "user", "content": query})
            messages.append({"role": "assistant", "content": f"Response to: {query}"})

            await asyncio.sleep(1)

    async def test_edge_case_queries(self):
        """Test edge cases that might break the system"""
        print("\n⚠️ Testing Edge Cases")
        print("-" * 40)

        edge_cases = [
            {
                "query": "",
                "description": "Empty query",
                "expected": "llama"
            },
            {
                "query": "a",
                "description": "Single character",
                "expected": "llama"
            },
            {
                "query": "What's the weather in a city that doesn't exist called Zyxwvutsrqponmlkjihgfedcba?",
                "description": "Non-existent location",
                "expected": "qwen_tools"
            },
            {
                "query": "What's the weather in " + "A" * 1000,
                "description": "Very long location name",
                "expected": "qwen_tools"
            },
            {
                "query": "🌤️☔️❄️🌦️⛈️🌩️🌨️☁️🌞🌝🌛🌜🌚🌕🌖🌗🌘🌑🌒🌓🌔",
                "description": "Only emojis",
                "expected": "llama"
            },
            {
                "query": "What's the weather in Paris? " * 10,
                "description": "Repeated question",
                "expected": "qwen_tools"
            },
            {
                "query": "What's the weather in Paris? And what's the weather in London? And what's the weather in Tokyo? And what's the weather in New York? And what's the weather in Berlin?",
                "description": "Multiple questions in one query",
                "expected": "qwen_tools"
            },
            {
                "query": "Weather weather weather weather weather",
                "description": "Repeated keywords",
                "expected": "qwen_tools"
            },
            {
                "query": "What's the weather in a city called '; DROP TABLE users; --'?",
                "description": "SQL injection attempt",
                "expected": "qwen_tools"
            },
            {
                "query": "What's the weather in <script>alert('hack')</script>?",
                "description": "XSS attempt",
                "expected": "qwen_tools"
            }
        ]

        for test in edge_cases:
            await self._run_single_test(
                test["query"],
                test["expected"],
                test["description"]
            )
            await asyncio.sleep(1)

    async def test_concurrent_requests(self):
        """Test system under concurrent load"""
        print("\n🚀 Testing Concurrent Requests")
        print("-" * 40)

        # Test 1: Concurrent simple queries
        print("   Testing concurrent simple queries...")
        simple_queries = [
            "Hi", "Hello", "How are you?", "What's up?", "Good morning!",
            "Tell me a joke", "Write a haiku", "What is AI?", "Explain Docker"
        ]

        tasks = []
        for i, query in enumerate(simple_queries):
            task = self._run_single_test(
                query,
                "llama",
                f"Concurrent simple {i+1}"
            )
            tasks.append(task)

        start_time = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        concurrent_time = time.time() - start_time
        print(f"   ✅ {len(simple_queries)} concurrent simple queries: {concurrent_time:.1f}s")

        await asyncio.sleep(2)

        # Test 2: Concurrent tool queries
        print("   Testing concurrent tool queries...")
        tool_queries = [
            "What's the weather in NYC?",
            "What's the weather in LA?",
            "What's the weather in Chicago?",
            "What's the weather in Miami?",
            "What's the latest news?"
        ]

        tasks = []
        for i, query in enumerate(tool_queries):
            task = self._run_single_test(
                query,
                "qwen_tools",
                f"Concurrent tool {i+1}"
            )
            tasks.append(task)

        start_time = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        concurrent_time = time.time() - start_time
        print(f"   ✅ {len(tool_queries)} concurrent tool queries: {concurrent_time:.1f}s")

        await asyncio.sleep(2)

        # Test 3: Mixed concurrent requests
        print("   Testing mixed concurrent requests...")
        mixed_queries = [
            ("Hi", "llama"),
            ("What's the weather in Paris?", "qwen_tools"),
            ("Tell me a joke", "llama"),
            ("Latest news", "qwen_tools"),
            ("What is Docker?", "llama"),
            ("Weather in London", "qwen_tools"),
            ("Write a poem", "llama"),
            ("Search for Python tutorials", "qwen_tools")
        ]

        tasks = []
        for i, (query, expected) in enumerate(mixed_queries):
            task = self._run_single_test(
                query,
                expected,
                f"Mixed concurrent {i+1}"
            )
            tasks.append(task)

        start_time = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        concurrent_time = time.time() - start_time
        print(f"   ✅ {len(mixed_queries)} mixed concurrent queries: {concurrent_time:.1f}s")

    async def _run_single_test(self, query: str, expected_route: str, description: str):
        """Run a single test case"""
        print(f"   🧪 {description}")
        print(f"      Query: {query[:60]}{'...' if len(query) > 60 else ''}")

        start_time = time.time()
        success = False
        actual_route = "unknown"

        try:
            response = await self.session.post(
                f"{self.api_url}/api/chat/stream",
                json={"message": query, "messages": []}
            )

            if response.status_code == 200:
                content = ""
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            if "token" in data:
                                content += data["token"]
                            elif "route" in data:
                                actual_route = data["route"]
                        except json.JSONDecodeError:
                            continue

                success = bool(content.strip())

                if actual_route == expected_route and success:
                    print(f"      ✅ Success ({time.time() - start_time:.1f}s)")
                elif success:
                    print(f"      ⚠️  Route mismatch: expected {expected_route}, got {actual_route}")
                else:
                    print(f"      ❌ No content received")
            else:
                print(f"      ❌ HTTP {response.status_code}")

        except Exception as e:
            print(f"      ❌ Exception: {str(e)[:50]}...")

        return success

    async def _run_single_test_with_history(self, query: str, expected_route: str, messages: List[Dict], description: str):
        """Run a single test case with conversation history"""
        print(f"   🧪 {description}")
        print(f"      Query: {query[:60]}{'...' if len(query) > 60 else ''}")

        start_time = time.time()
        success = False

        try:
            response = await self.session.post(
                f"{self.api_url}/api/chat/stream",
                json={"message": query, "messages": messages}
            )

            if response.status_code == 200:
                content = ""
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            if "token" in data:
                                content += data["token"]
                        except json.JSONDecodeError:
                            continue

                success = bool(content.strip())

                if success:
                    print(f"      ✅ Success ({time.time() - start_time:.1f}s)")
                else:
                    print(f"      ❌ No content received")
            else:
                print(f"      ❌ HTTP {response.status_code}")

        except Exception as e:
            print(f"      ❌ Exception: {str(e)[:50]}...")

        return success

    async def run_all_stress_tests(self):
        """Run all stress tests"""
        print("🔥 STRESS TEST: EDGE CASES & TOOL COMBINATIONS")
        print("=" * 60)
        print("Testing the most challenging scenarios for the multi-model system")

        try:
            await self.test_ambiguous_routing()
            await self.test_tool_chain_complexity()
            await self.test_context_switching()
            await self.test_edge_case_queries()
            await self.test_concurrent_requests()

            print("\n🏁 All stress tests completed!")

        except Exception as e:
            print(f"\n❌ Stress test failed: {e}")


async def main():
    """Run stress tests"""
    async with StressTestEdgeCases() as stress_test:
        await stress_test.run_all_stress_tests()


if __name__ == "__main__":
    asyncio.run(main())
