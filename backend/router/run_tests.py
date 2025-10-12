#!/usr/bin/env python3
"""
Test Runner for GeistAI Multi-Model Architecture

Easy way to run different test suites and validate the system.
"""

import asyncio
import sys
import argparse
from pathlib import Path

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from comprehensive_test_suite import ComprehensiveTestSuite
from stress_test_edge_cases import StressTestEdgeCases
from test_router import main as test_router_main
from test_mvp_queries import main as test_mvp_main


async def run_comprehensive_tests():
    """Run the comprehensive test suite"""
    print("🧪 Running Comprehensive Test Suite...")
    async with ComprehensiveTestSuite() as test_suite:
        await test_suite.run_all_tests()


async def run_stress_tests():
    """Run stress tests for edge cases"""
    print("🔥 Running Stress Tests...")
    async with StressTestEdgeCases() as stress_test:
        await stress_test.run_all_stress_tests()


def run_router_tests():
    """Run router unit tests"""
    print("🎯 Running Router Unit Tests...")
    test_router_main()


async def run_mvp_tests():
    """Run MVP query tests"""
    print("🚀 Running MVP Query Tests...")
    await test_mvp_main()


async def run_quick_smoke_test():
    """Run a quick smoke test to verify basic functionality"""
    print("💨 Running Quick Smoke Test...")

    import httpx

    test_cases = [
        ("Hi there!", "llama", "Simple greeting"),
        ("What's the weather in Paris?", "qwen_tools", "Weather query"),
        ("Tell me a joke", "llama", "Creative query"),
        ("What's the latest news?", "qwen_tools", "News query"),
        ("What is Docker?", "llama", "Knowledge query")
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        for query, expected_route, description in test_cases:
            print(f"\n   🧪 {description}")
            print(f"      Query: {query}")

            try:
                response = await client.post(
                    "http://localhost:8000/api/chat/stream",
                    json={"message": query, "messages": []}
                )

                if response.status_code == 200:
                    content = ""
                    route = "unknown"

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            try:
                                import json
                                data = json.loads(line[6:])
                                if "token" in data:
                                    content += data["token"]
                                elif "route" in data:
                                    route = data["route"]
                            except:
                                continue

                    if content.strip():
                        print(f"      ✅ Success - Route: {route}, Content: {len(content)} chars")
                    else:
                        print(f"      ❌ No content")
                else:
                    print(f"      ❌ HTTP {response.status_code}")

            except Exception as e:
                print(f"      ❌ Error: {e}")

            await asyncio.sleep(1)

    print("\n💨 Smoke test completed!")


def main():
    """Main test runner with command line options"""
    parser = argparse.ArgumentParser(description="GeistAI Test Runner")
    parser.add_argument(
        "test_type",
        choices=["all", "comprehensive", "stress", "router", "mvp", "smoke"],
        help="Type of test to run"
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="API URL for testing (default: http://localhost:8000)"
    )

    args = parser.parse_args()

    print("🧪 GEISTAI TEST RUNNER")
    print("=" * 50)
    print(f"Test Type: {args.test_type}")
    print(f"API URL: {args.api_url}")
    print()

    if args.test_type == "all":
        # Run all tests in sequence
        async def run_all():
            await run_quick_smoke_test()
            print("\n" + "="*50)
            run_router_tests()
            print("\n" + "="*50)
            await run_mvp_tests()
            print("\n" + "="*50)
            await run_comprehensive_tests()
            print("\n" + "="*50)
            await run_stress_tests()

        asyncio.run(run_all())

    elif args.test_type == "comprehensive":
        asyncio.run(run_comprehensive_tests())

    elif args.test_type == "stress":
        asyncio.run(run_stress_tests())

    elif args.test_type == "router":
        run_router_tests()

    elif args.test_type == "mvp":
        asyncio.run(run_mvp_tests())

    elif args.test_type == "smoke":
        asyncio.run(run_quick_smoke_test())

    print("\n🏁 Test run completed!")


if __name__ == "__main__":
    main()
