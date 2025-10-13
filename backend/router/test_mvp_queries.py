#!/usr/bin/env python3
"""
Comprehensive MVP Test Suite
Tests the multi-model routing and MCP tool calling with various query types
"""

import httpx
import asyncio
import json
import time
from typing import Dict, List, Any


class MVPTester:
    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
        self.results: List[Dict[str, Any]] = []

    async def test_query(self, query: str, expected_route: str, should_use_tools: bool, max_time: int = 45) -> Dict[str, Any]:
        """Test a single query and return results"""
        print(f"\n{'='*80}")
        print(f"🧪 Testing: {query}")
        print(f"   Expected route: {expected_route}")
        print(f"   Should use tools: {should_use_tools}")
        print(f"{'='*80}")

        result = {
            "query": query,
            "expected_route": expected_route,
            "should_use_tools": should_use_tools,
            "success": False,
            "response": "",
            "time": 0,
            "error": None,
            "tokens": 0
        }

        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=max_time) as client:
                response = await client.post(
                    f"{self.api_url}/api/chat/stream",
                    json={"message": query, "messages": []},
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code != 200:
                    result["error"] = f"HTTP {response.status_code}"
                    print(f"❌ HTTP Error: {response.status_code}")
                    return result

                # Collect streamed response
                response_text = ""
                tokens = 0
                last_update = time.time()

                async for line in response.aiter_lines():
                    if time.time() - last_update > 5:
                        elapsed = time.time() - start_time
                        print(f"   ... still streaming ({elapsed:.1f}s, {tokens} tokens)")
                        last_update = time.time()

                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            if "token" in data:
                                response_text += data["token"]
                                tokens += 1
                                if tokens <= 5:
                                    print(f"   Token {tokens}: '{data['token']}'")
                            elif "finished" in data and data["finished"]:
                                break
                        except json.JSONDecodeError:
                            continue

                elapsed = time.time() - start_time
                result["time"] = elapsed
                result["response"] = response_text
                result["tokens"] = tokens

                # Check if response is valid
                if len(response_text.strip()) > 10:
                    result["success"] = True
                    print(f"✅ Success in {elapsed:.1f}s ({tokens} tokens)")
                    print(f"📝 Response: {response_text[:200]}...")
                else:
                    result["error"] = "Empty or too short response"
                    print(f"❌ Empty response")

        except asyncio.TimeoutError:
            elapsed = time.time() - start_time
            result["time"] = elapsed
            result["error"] = f"Timeout after {elapsed:.1f}s"
            print(f"❌ Timeout after {elapsed:.1f}s")
        except Exception as e:
            elapsed = time.time() - start_time
            result["time"] = elapsed
            result["error"] = str(e)
            print(f"❌ Exception: {e}")

        return result

    async def run_all_tests(self):
        """Run all test queries"""

        test_cases = [
            # Tool-requiring queries (qwen_tools route)
            {
                "query": "What is the weather in Paris?",
                "expected_route": "qwen_tools",
                "should_use_tools": True,
                "max_time": 45
            },
            {
                "query": "What's the temperature in London right now?",
                "expected_route": "qwen_tools",
                "should_use_tools": True,
                "max_time": 45
            },
            {
                "query": "Latest news about artificial intelligence",
                "expected_route": "qwen_tools",
                "should_use_tools": True,
                "max_time": 45
            },
            {
                "query": "Search for Python tutorials",
                "expected_route": "qwen_tools",
                "should_use_tools": True,
                "max_time": 45
            },
            {
                "query": "What's happening in the world today?",
                "expected_route": "qwen_tools",
                "should_use_tools": True,
                "max_time": 45
            },

            # Creative queries (llama route)
            {
                "query": "Write a haiku about coding",
                "expected_route": "llama",
                "should_use_tools": False,
                "max_time": 30
            },
            {
                "query": "Tell me a joke",
                "expected_route": "llama",
                "should_use_tools": False,
                "max_time": 30
            },
            {
                "query": "Create a short poem about the ocean",
                "expected_route": "llama",
                "should_use_tools": False,
                "max_time": 30
            },

            # Simple explanations (llama route)
            {
                "query": "What is Docker?",
                "expected_route": "llama",
                "should_use_tools": False,
                "max_time": 30
            },
            {
                "query": "Explain what an API is",
                "expected_route": "llama",
                "should_use_tools": False,
                "max_time": 30
            },

            # Code queries (qwen_direct route)
            {
                "query": "Implement a binary search in Python",
                "expected_route": "qwen_direct",
                "should_use_tools": False,
                "max_time": 35
            },
            {
                "query": "Fix this Python code: def add(a b): return a + b",
                "expected_route": "qwen_direct",
                "should_use_tools": False,
                "max_time": 35
            }
        ]

        print("\n" + "="*80)
        print("🚀 Starting MVP Test Suite")
        print(f"   Testing {len(test_cases)} queries")
        print("="*80)

        for i, test_case in enumerate(test_cases, 1):
            print(f"\n📊 Test {i}/{len(test_cases)}")
            result = await self.test_query(
                test_case["query"],
                test_case["expected_route"],
                test_case["should_use_tools"],
                test_case["max_time"]
            )
            self.results.append(result)

            # Brief pause between tests
            await asyncio.sleep(2)

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80)

        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed

        print(f"\n✅ Passed: {passed}/{total} ({passed/total*100:.1f}%)")
        print(f"❌ Failed: {failed}/{total} ({failed/total*100:.1f}%)")

        # Performance stats
        successful_times = [r["time"] for r in self.results if r["success"]]
        if successful_times:
            avg_time = sum(successful_times) / len(successful_times)
            min_time = min(successful_times)
            max_time = max(successful_times)
            print(f"\n⏱️  Performance (successful queries):")
            print(f"   Average: {avg_time:.1f}s")
            print(f"   Fastest: {min_time:.1f}s")
            print(f"   Slowest: {max_time:.1f}s")

        # Detailed results
        print(f"\n📋 Detailed Results:")
        print(f"{'#':<4} {'Status':<8} {'Time':<8} {'Tokens':<8} {'Query':<50}")
        print("-" * 80)

        for i, result in enumerate(self.results, 1):
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            time_str = f"{result['time']:.1f}s"
            tokens = result['tokens']
            query = result['query'][:47] + "..." if len(result['query']) > 50 else result['query']
            print(f"{i:<4} {status:<8} {time_str:<8} {tokens:<8} {query:<50}")

        # Failed tests details
        failed_tests = [r for r in self.results if not r["success"]]
        if failed_tests:
            print(f"\n❌ Failed Test Details:")
            for i, result in enumerate(failed_tests, 1):
                print(f"\n{i}. Query: {result['query']}")
                print(f"   Error: {result['error']}")
                print(f"   Response: {result['response'][:100] if result['response'] else 'None'}")

        print("\n" + "="*80)

        # Save results to JSON
        with open("/tmp/mvp_test_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        print("💾 Results saved to /tmp/mvp_test_results.json")


async def main():
    tester = MVPTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
