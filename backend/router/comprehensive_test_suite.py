#!/usr/bin/env python3
"""
Comprehensive Test Suite for GeistAI Multi-Model Architecture

Tests multiple edge cases, conversation flows, and tool combinations
to validate the robustness of the new Llama + Qwen system.
"""

import asyncio
import httpx
import json
import time
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass


@dataclass
class TestResult:
    """Test result data structure"""
    test_name: str
    query: str
    expected_route: str
    actual_route: str
    response_time: float
    success: bool
    response_content: str
    error: Optional[str] = None
    artifacts_detected: bool = False
    tool_calls_made: int = 0


class ComprehensiveTestSuite:
    """Comprehensive test suite for edge cases and complex scenarios"""

    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
        self.results: List[TestResult] = []
        self.session = None

    async def __aenter__(self):
        self.session = httpx.AsyncClient(timeout=60.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()

    async def run_single_test(self, test_case: Dict[str, Any]) -> TestResult:
        """Run a single test case and return detailed results"""
        test_name = test_case["name"]
        query = test_case["query"]
        expected_route = test_case.get("expected_route", "unknown")

        print(f"\n🧪 Running: {test_name}")
        print(f"   Query: {query}")
        print(f"   Expected route: {expected_route}")

        start_time = time.time()
        response_content = ""
        error = None
        success = False
        artifacts_detected = False
        tool_calls_made = 0
        actual_route = "unknown"

        try:
            # Send request
            response = await self.session.post(
                f"{self.api_url}/api/chat/stream",
                json={
                    "message": query,
                    "messages": test_case.get("messages", [])
                }
            )

            if response.status_code != 200:
                error = f"HTTP {response.status_code}: {response.text}"
                print(f"   ❌ HTTP Error: {error}")
            else:
                # Stream response
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            if "token" in data:
                                response_content += data["token"]
                            elif "route" in data:
                                actual_route = data["route"]
                            elif "tool_calls" in data:
                                tool_calls_made += len(data["tool_calls"])
                        except json.JSONDecodeError:
                            continue

                # Check for artifacts
                artifacts_detected = self._detect_artifacts(response_content)
                success = True

                # Route validation
                if expected_route != "unknown" and actual_route != expected_route:
                    print(f"   ⚠️  Route mismatch: expected {expected_route}, got {actual_route}")

        except Exception as e:
            error = str(e)
            print(f"   ❌ Exception: {error}")

        response_time = time.time() - start_time

        # Determine success
        if success and not artifacts_detected and response_content.strip():
            if expected_route == "unknown" or actual_route == expected_route:
                print(f"   ✅ Success ({response_time:.1f}s, {len(response_content)} chars)")
            else:
                print(f"   ⚠️  Route mismatch but content OK")
        else:
            print(f"   ❌ Failed: {error or 'No content or artifacts detected'}")

        result = TestResult(
            test_name=test_name,
            query=query,
            expected_route=expected_route,
            actual_route=actual_route,
            response_time=response_time,
            success=success and not artifacts_detected and bool(response_content.strip()),
            response_content=response_content,
            error=error,
            artifacts_detected=artifacts_detected,
            tool_calls_made=tool_calls_made
        )

        self.results.append(result)
        return result

    def _detect_artifacts(self, content: str) -> bool:
        """Detect Harmony format artifacts and other issues"""
        artifact_patterns = [
            r'<\|channel\|>',
            r'<\|message\|>',
            r'<\|end\|>',
            r'assistantanalysis',
            r'to=browser',
            r'We need to (answer|check|provide|browse)',
            r'Let\'s (open|browse|check)',
            r'The user (asks|wants|needs|provided)'
        ]

        for pattern in artifact_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True
        return False

    async def run_edge_case_tests(self):
        """Test edge cases and ambiguous queries"""
        edge_cases = [
            {
                "name": "Ambiguous Weather Query",
                "query": "How's the weather today?",
                "expected_route": "llama",  # Should be simple conversation
                "messages": []
            },
            {
                "name": "Ambiguous News Query",
                "query": "What's the news?",
                "expected_route": "qwen_tools",  # Needs current info
                "messages": []
            },
            {
                "name": "Mixed Intent Query",
                "query": "Tell me about the weather and write a poem about rain",
                "expected_route": "qwen_tools",  # Weather needs tools
                "messages": []
            },
            {
                "name": "Very Short Query",
                "query": "Hi",
                "expected_route": "llama",
                "messages": []
            },
            {
                "name": "Very Long Query",
                "query": "Can you please help me understand the complex relationship between quantum mechanics and general relativity, specifically how they might be unified in a theory of quantum gravity, and also explain the role of string theory in this unification while considering the implications for black hole physics and the holographic principle?",
                "expected_route": "qwen_direct",
                "messages": []
            },
            {
                "name": "Code + Weather Mix",
                "query": "Debug this Python code and also check the weather in Tokyo",
                "expected_route": "qwen_tools",  # Weather needs tools
                "messages": []
            },
            {
                "name": "Empty Query",
                "query": "",
                "expected_route": "llama",
                "messages": []
            },
            {
                "name": "Special Characters",
                "query": "What's the weather like? 🌤️☔️❄️",
                "expected_route": "llama",  # Simple conversation
                "messages": []
            }
        ]

        print("\n🔍 Running Edge Case Tests")
        print("=" * 60)

        for test_case in edge_cases:
            await self.run_single_test(test_case)
            await asyncio.sleep(1)  # Brief pause between tests

    async def run_conversation_flow_tests(self):
        """Test multi-turn conversations with context switching"""
        conversation_flows = [
            {
                "name": "Weather → Follow-up → Creative",
                "steps": [
                    {
                        "query": "What's the weather in Paris?",
                        "expected_route": "qwen_tools",
                        "messages": []
                    },
                    {
                        "query": "What about London?",
                        "expected_route": "qwen_tools",
                        "messages": [
                            {"role": "user", "content": "What's the weather in Paris?"},
                            {"role": "assistant", "content": "The weather in Paris is..."}
                        ]
                    },
                    {
                        "query": "Now write a haiku about rain",
                        "expected_route": "llama",
                        "messages": [
                            {"role": "user", "content": "What's the weather in Paris?"},
                            {"role": "assistant", "content": "The weather in Paris is..."},
                            {"role": "user", "content": "What about London?"},
                            {"role": "assistant", "content": "The weather in London is..."}
                        ]
                    }
                ]
            },
            {
                "name": "Creative → News → Code",
                "steps": [
                    {
                        "query": "Tell me a joke",
                        "expected_route": "llama",
                        "messages": []
                    },
                    {
                        "query": "What's the latest AI news?",
                        "expected_route": "qwen_tools",
                        "messages": [
                            {"role": "user", "content": "Tell me a joke"},
                            {"role": "assistant", "content": "Why don't scientists trust atoms? Because they make up everything! 😄"}
                        ]
                    },
                    {
                        "query": "Implement a binary search in Python",
                        "expected_route": "qwen_direct",
                        "messages": [
                            {"role": "user", "content": "Tell me a joke"},
                            {"role": "assistant", "content": "Why don't scientists trust atoms? Because they make up everything! 😄"},
                            {"role": "user", "content": "What's the latest AI news?"},
                            {"role": "assistant", "content": "Latest AI news includes..."}
                        ]
                    }
                ]
            },
            {
                "name": "Context Switching: Simple → Complex → Simple",
                "steps": [
                    {
                        "query": "Hello there!",
                        "expected_route": "llama",
                        "messages": []
                    },
                    {
                        "query": "Explain quantum entanglement in detail",
                        "expected_route": "llama",  # Knowledge query, no tools needed
                        "messages": [
                            {"role": "user", "content": "Hello there!"},
                            {"role": "assistant", "content": "Hello! How can I help you today?"}
                        ]
                    },
                    {
                        "query": "Thanks! How are you?",
                        "expected_route": "llama",
                        "messages": [
                            {"role": "user", "content": "Hello there!"},
                            {"role": "assistant", "content": "Hello! How can I help you today?"},
                            {"role": "user", "content": "Explain quantum entanglement in detail"},
                            {"role": "assistant", "content": "Quantum entanglement is a phenomenon..."}
                        ]
                    }
                ]
            }
        ]

        print("\n💬 Running Conversation Flow Tests")
        print("=" * 60)

        for flow in conversation_flows:
            print(f"\n📝 Flow: {flow['name']}")
            for i, step in enumerate(flow['steps'], 1):
                step_name = f"{flow['name']} - Step {i}"
                test_case = {
                    "name": step_name,
                    "query": step["query"],
                    "expected_route": step["expected_route"],
                    "messages": step["messages"]
                }
                await self.run_single_test(test_case)
                await asyncio.sleep(1)

    async def run_tool_combination_tests(self):
        """Test complex tool combinations and edge cases"""
        tool_tests = [
            {
                "name": "Weather + News Combination",
                "query": "What's the weather in Tokyo and what's the latest news about Japan?",
                "expected_route": "qwen_tools",
                "messages": []
            },
            {
                "name": "Multiple Location Weather",
                "query": "Compare the weather between New York, London, and Tokyo",
                "expected_route": "qwen_tools",
                "messages": []
            },
            {
                "name": "Historical + Current Info",
                "query": "What happened in Japan yesterday and what's the weather there today?",
                "expected_route": "qwen_tools",
                "messages": []
            },
            {
                "name": "Search + Fetch Combination",
                "query": "Search for Python tutorials and fetch the content from the best one",
                "expected_route": "qwen_tools",
                "messages": []
            },
            {
                "name": "Complex Multi-Tool Query",
                "query": "Find the latest news about AI, check the weather in Silicon Valley, and search for job openings at tech companies",
                "expected_route": "qwen_tools",
                "messages": []
            },
            {
                "name": "Creative + Factual Mix",
                "query": "Write a poem about the weather in Paris today",
                "expected_route": "qwen_tools",  # Weather needs tools
                "messages": []
            }
        ]

        print("\n🔧 Running Tool Combination Tests")
        print("=" * 60)

        for test_case in tool_tests:
            await self.run_single_test(test_case)
            await asyncio.sleep(2)  # Longer pause for tool-heavy tests

    async def run_performance_tests(self):
        """Test performance under various loads"""
        performance_tests = [
            {
                "name": "Rapid Fire Simple Queries",
                "queries": [
                    "Hi", "Hello", "How are you?", "What's up?", "Good morning!"
                ],
                "expected_route": "llama",
                "concurrent": False
            },
            {
                "name": "Rapid Fire Tool Queries",
                "queries": [
                    "Weather in NYC", "Weather in LA", "Weather in Chicago", "Weather in Miami", "Weather in Seattle"
                ],
                "expected_route": "qwen_tools",
                "concurrent": False
            },
            {
                "name": "Concurrent Simple Queries",
                "queries": [
                    "Tell me a joke", "Write a haiku", "What is AI?", "Explain Docker", "Define API"
                ],
                "expected_route": "llama",
                "concurrent": True
            }
        ]

        print("\n⚡ Running Performance Tests")
        print("=" * 60)

        for perf_test in performance_tests:
            print(f"\n🚀 {perf_test['name']}")

            if perf_test["concurrent"]:
                # Run queries concurrently
                tasks = []
                for i, query in enumerate(perf_test["queries"]):
                    test_case = {
                        "name": f"{perf_test['name']} - Query {i+1}",
                        "query": query,
                        "expected_route": perf_test["expected_route"],
                        "messages": []
                    }
                    tasks.append(self.run_single_test(test_case))

                start_time = time.time()
                await asyncio.gather(*tasks)
                total_time = time.time() - start_time
                print(f"   📊 Concurrent execution: {total_time:.1f}s total")

            else:
                # Run queries sequentially
                start_time = time.time()
                for i, query in enumerate(perf_test["queries"]):
                    test_case = {
                        "name": f"{perf_test['name']} - Query {i+1}",
                        "query": query,
                        "expected_route": perf_test["expected_route"],
                        "messages": []
                    }
                    await self.run_single_test(test_case)
                    await asyncio.sleep(0.5)  # Brief pause

                total_time = time.time() - start_time
                print(f"   📊 Sequential execution: {total_time:.1f}s total")

    async def run_all_tests(self):
        """Run the complete comprehensive test suite"""
        print("🧪 COMPREHENSIVE TEST SUITE FOR GEISTAI")
        print("=" * 80)
        print(f"Testing multi-model architecture: Qwen + Llama")
        print(f"API URL: {self.api_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            # Test 1: Edge Cases
            await self.run_edge_case_tests()

            # Test 2: Conversation Flows
            await self.run_conversation_flow_tests()

            # Test 3: Tool Combinations
            await self.run_tool_combination_tests()

            # Test 4: Performance Tests
            await self.run_performance_tests()

        except Exception as e:
            print(f"\n❌ Test suite failed with exception: {e}")

        # Generate comprehensive report
        self.generate_report()

    def generate_report(self):
        """Generate a comprehensive test report"""
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST REPORT")
        print("=" * 80)

        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results if r.success)
        failed_tests = total_tests - successful_tests
        artifact_tests = sum(1 for r in self.results if r.artifacts_detected)

        print(f"\n📈 SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   ✅ Successful: {successful_tests} ({successful_tests/total_tests*100:.1f}%)")
        print(f"   ❌ Failed: {failed_tests} ({failed_tests/total_tests*100:.1f}%)")
        print(f"   🎭 Artifacts: {artifact_tests} ({artifact_tests/total_tests*100:.1f}%)")

        # Route analysis
        route_stats = {}
        for result in self.results:
            route = result.actual_route
            if route not in route_stats:
                route_stats[route] = {"count": 0, "success": 0, "avg_time": 0}
            route_stats[route]["count"] += 1
            if result.success:
                route_stats[route]["success"] += 1
            route_stats[route]["avg_time"] += result.response_time

        print(f"\n🎯 ROUTE ANALYSIS:")
        for route, stats in route_stats.items():
            success_rate = stats["success"] / stats["count"] * 100
            avg_time = stats["avg_time"] / stats["count"]
            print(f"   {route}: {stats['count']} tests, {success_rate:.1f}% success, {avg_time:.1f}s avg")

        # Performance analysis
        response_times = [r.response_time for r in self.results if r.success]
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            min_time = min(response_times)
            max_time = max(response_times)
            print(f"\n⚡ PERFORMANCE:")
            print(f"   Average Response Time: {avg_time:.1f}s")
            print(f"   Fastest Response: {min_time:.1f}s")
            print(f"   Slowest Response: {max_time:.1f}s")

        # Failed tests details
        failed_results = [r for r in self.results if not r.success]
        if failed_results:
            print(f"\n❌ FAILED TESTS:")
            for result in failed_results:
                print(f"   • {result.test_name}: {result.error or 'No content/artifacts'}")

        # Artifact analysis
        artifact_results = [r for r in self.results if r.artifacts_detected]
        if artifact_results:
            print(f"\n🎭 ARTIFACT DETECTION:")
            for result in artifact_results:
                print(f"   • {result.test_name}: {result.response_content[:100]}...")

        print(f"\n🏁 Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


async def main():
    """Main test runner"""
    async with ComprehensiveTestSuite() as test_suite:
        await test_suite.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
