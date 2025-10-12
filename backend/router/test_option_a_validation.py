#!/usr/bin/env python3
"""
Comprehensive test suite to validate Option A (increased findings truncation)
Tests various query types to ensure robustness for MVP launch.
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Dict, List, Any

# Test configuration
ROUTER_URL = "http://localhost:8000"
TIMEOUT = 60.0  # 60 seconds max per query

class TestResult:
    def __init__(self, test_name: str, query: str):
        self.test_name = test_name
        self.query = query
        self.success = False
        self.response_text = ""
        self.total_time = 0.0
        self.first_token_time = 0.0
        self.token_count = 0
        self.error = None
        self.has_real_data = False
        self.has_sources = False
        self.quality_score = 0  # 0-10

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "query": self.query,
            "success": self.success,
            "response_length": len(self.response_text),
            "response_preview": self.response_text[:200] + "..." if len(self.response_text) > 200 else self.response_text,
            "total_time": f"{self.total_time:.2f}s",
            "first_token_time": f"{self.first_token_time:.2f}s" if self.first_token_time > 0 else "N/A",
            "token_count": self.token_count,
            "tokens_per_second": f"{self.token_count / self.total_time:.2f}" if self.total_time > 0 else "N/A",
            "has_real_data": self.has_real_data,
            "has_sources": self.has_sources,
            "quality_score": self.quality_score,
            "error": self.error,
        }

# Test cases covering different scenarios
TEST_CASES = [
    {
        "name": "Weather Query (Primary Use Case)",
        "query": "What's the weather like in London?",
        "expected_keywords": ["temperature", "°", "weather", "london"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
    {
        "name": "Weather Query - Different City",
        "query": "Current weather in Paris France",
        "expected_keywords": ["temperature", "°", "weather", "paris"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
    {
        "name": "News Query",
        "query": "What's the latest news about AI?",
        "expected_keywords": ["ai", "artificial intelligence", "recent", "news"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
    {
        "name": "Search Query",
        "query": "Who won the Nobel Prize in Physics 2024?",
        "expected_keywords": ["nobel", "physics", "2024"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
    {
        "name": "Simple Creative Query",
        "query": "Write a haiku about coding",
        "expected_keywords": ["code", "coding"],
        "should_have_sources": False,
        "category": "creative"
    },
    {
        "name": "Simple Knowledge Query",
        "query": "What is Python programming language?",
        "expected_keywords": ["python", "programming"],
        "should_have_sources": False,
        "category": "simple"
    },
    {
        "name": "Multi-City Weather",
        "query": "What's the weather in New York and Los Angeles?",
        "expected_keywords": ["temperature", "weather", "°"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
    {
        "name": "Current Events",
        "query": "What happened in the world today?",
        "expected_keywords": ["news", "today", "recent"],
        "should_have_sources": True,
        "category": "tool_calling"
    },
]

async def run_single_test(test_case: Dict[str, Any]) -> TestResult:
    """Run a single test case and measure results"""
    result = TestResult(test_case["name"], test_case["query"])

    print(f"\n{'='*80}")
    print(f"🧪 Test: {test_case['name']}")
    print(f"📝 Query: {test_case['query']}")
    print(f"{'='*80}")

    start_time = time.time()
    first_token_received = False
    first_token_time = 0.0

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response_text = ""
            token_count = 0

            # Stream the response
            async with client.stream(
                "POST",
                f"{ROUTER_URL}/api/chat/stream",
                json={
                    "message": test_case["query"],
                    "messages": []
                }
            ) as response:

                if response.status_code != 200:
                    result.error = f"HTTP {response.status_code}"
                    print(f"❌ HTTP Error: {response.status_code}")
                    return result

                print(f"⏳ Streaming response...")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                            if "token" in data and data["token"]:
                                if not first_token_received:
                                    first_token_time = time.time() - start_time
                                    result.first_token_time = first_token_time
                                    first_token_received = True
                                    print(f"⚡ First token: {first_token_time:.2f}s")

                                response_text += data["token"]
                                token_count += 1

                                # Progress indicator
                                if token_count % 20 == 0:
                                    elapsed = time.time() - start_time
                                    print(f"   📊 {token_count} tokens in {elapsed:.1f}s")

                        except json.JSONDecodeError:
                            continue

            result.total_time = time.time() - start_time
            result.response_text = response_text
            result.token_count = token_count
            result.success = True

            # Quality checks
            response_lower = response_text.lower()

            # Check for expected keywords
            keyword_matches = sum(1 for kw in test_case["expected_keywords"] if kw.lower() in response_lower)

            # Check for sources if expected
            has_sources = any(marker in response_text for marker in ["http://", "https://", "Source:", "Sources:"])
            result.has_sources = has_sources

            # Check for real data (not just "I don't know" or error messages)
            negative_indicators = [
                "i don't have",
                "i can't access",
                "unfortunately",
                "i cannot",
                "not available",
                "incomplete",
                "not accessible"
            ]
            has_negative = any(phrase in response_lower for phrase in negative_indicators)
            result.has_real_data = not has_negative and len(response_text) > 50

            # Calculate quality score (0-10)
            quality = 0
            quality += 3 if keyword_matches >= len(test_case["expected_keywords"]) * 0.5 else 0  # Keywords
            quality += 2 if len(response_text) > 100 else 0  # Sufficient length
            quality += 2 if test_case["should_have_sources"] == has_sources else 0  # Source matching
            quality += 2 if result.has_real_data else 0  # Real data
            quality += 1 if result.total_time < 35 else 0  # Reasonable speed

            result.quality_score = quality

            # Print results
            print(f"\n✅ Test Complete!")
            print(f"⏱️  Total Time: {result.total_time:.2f}s")
            print(f"📊 Tokens: {token_count} ({token_count/result.total_time:.2f} tok/s)")
            print(f"📝 Response Length: {len(response_text)} chars")
            print(f"🎯 Quality Score: {quality}/10")
            print(f"   - Keyword matches: {keyword_matches}/{len(test_case['expected_keywords'])}")
            print(f"   - Has sources: {'✅' if has_sources else '❌'} (expected: {'✅' if test_case['should_have_sources'] else '❌'})")
            print(f"   - Has real data: {'✅' if result.has_real_data else '❌'}")
            print(f"\n📄 Response Preview:")
            print(f"{response_text[:300]}...")

    except asyncio.TimeoutError:
        result.error = "Timeout"
        result.total_time = TIMEOUT
        print(f"❌ Test timed out after {TIMEOUT}s")
    except Exception as e:
        result.error = str(e)
        result.total_time = time.time() - start_time
        print(f"❌ Test failed: {e}")

    return result

async def run_all_tests():
    """Run all test cases and generate report"""
    print(f"\n{'#'*80}")
    print(f"# Option A Validation Test Suite")
    print(f"# Testing increased findings truncation (200 → 1000 chars)")
    print(f"# Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*80}\n")

    results = []

    for i, test_case in enumerate(TEST_CASES, 1):
        print(f"\n🔹 Running test {i}/{len(TEST_CASES)}")
        result = await run_single_test(test_case)
        results.append(result)

        # Small delay between tests
        if i < len(TEST_CASES):
            print(f"\n⏸️  Waiting 2 seconds before next test...")
            await asyncio.sleep(2)

    # Generate summary report
    print(f"\n\n{'='*80}")
    print(f"📊 TEST SUMMARY REPORT")
    print(f"{'='*80}\n")

    # Overall stats
    total_tests = len(results)
    successful_tests = sum(1 for r in results if r.success)
    high_quality = sum(1 for r in results if r.quality_score >= 7)
    medium_quality = sum(1 for r in results if 4 <= r.quality_score < 7)
    low_quality = sum(1 for r in results if r.quality_score < 4)

    print(f"✅ Success Rate: {successful_tests}/{total_tests} ({successful_tests/total_tests*100:.1f}%)")
    print(f"🌟 High Quality (7-10): {high_quality}/{total_tests} ({high_quality/total_tests*100:.1f}%)")
    print(f"⚠️  Medium Quality (4-6): {medium_quality}/{total_tests} ({medium_quality/total_tests*100:.1f}%)")
    print(f"❌ Low Quality (0-3): {low_quality}/{total_tests} ({low_quality/total_tests*100:.1f}%)")

    # Performance stats
    avg_time = sum(r.total_time for r in results if r.success) / max(successful_tests, 1)
    avg_first_token = sum(r.first_token_time for r in results if r.first_token_time > 0) / max(sum(1 for r in results if r.first_token_time > 0), 1)
    avg_tokens = sum(r.token_count for r in results if r.success) / max(successful_tests, 1)

    print(f"\n⏱️  Performance:")
    print(f"   Average Total Time: {avg_time:.2f}s")
    print(f"   Average First Token: {avg_first_token:.2f}s")
    print(f"   Average Token Count: {avg_tokens:.0f}")

    # Category breakdown
    print(f"\n📊 By Category:")
    categories = {}
    for r in results:
        cat = [tc for tc in TEST_CASES if tc["name"] == r.test_name][0]["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "success": 0, "high_quality": 0}
        categories[cat]["total"] += 1
        if r.success:
            categories[cat]["success"] += 1
        if r.quality_score >= 7:
            categories[cat]["high_quality"] += 1

    for cat, stats in categories.items():
        print(f"   {cat.upper()}: {stats['success']}/{stats['total']} success, {stats['high_quality']}/{stats['total']} high quality")

    # Individual results
    print(f"\n📝 Individual Test Results:")
    print(f"{'='*80}")
    for i, result in enumerate(results, 1):
        status = "✅" if result.success else "❌"
        quality_emoji = "🌟" if result.quality_score >= 7 else "⚠️ " if result.quality_score >= 4 else "❌"
        print(f"\n{i}. {status} {result.test_name}")
        print(f"   Query: {result.query}")
        print(f"   Quality: {quality_emoji} {result.quality_score}/10")
        print(f"   Time: {result.total_time:.2f}s (first token: {result.first_token_time:.2f}s)")
        print(f"   Tokens: {result.token_count}")
        print(f"   Real Data: {'✅' if result.has_real_data else '❌'}")
        print(f"   Sources: {'✅' if result.has_sources else '❌'}")
        if result.error:
            print(f"   Error: {result.error}")
        print(f"   Preview: {result.response_text[:150]}...")

    # Final verdict
    print(f"\n\n{'='*80}")
    print(f"🎯 FINAL VERDICT")
    print(f"{'='*80}\n")

    if successful_tests >= total_tests * 0.8 and high_quality >= total_tests * 0.6:
        print(f"✅ PASS: Option A is robust and ready for MVP!")
        print(f"   - High success rate ({successful_tests/total_tests*100:.0f}%)")
        print(f"   - Good quality responses ({high_quality/total_tests*100:.0f}% high quality)")
        print(f"   - Acceptable performance (~{avg_time:.0f}s average)")
    elif successful_tests >= total_tests * 0.6:
        print(f"⚠️  CONDITIONAL PASS: Option A works but has issues")
        print(f"   - Acceptable success rate ({successful_tests/total_tests*100:.0f}%)")
        print(f"   - Quality could be better ({high_quality/total_tests*100:.0f}% high quality)")
        print(f"   - Consider further optimization")
    else:
        print(f"❌ FAIL: Option A needs more work")
        print(f"   - Low success rate ({successful_tests/total_tests*100:.0f}%)")
        print(f"   - Too many low quality responses")
        print(f"   - Recommend investigating issues before MVP")

    print(f"\n{'='*80}\n")

    # Save detailed results to JSON
    with open("test_results_option_a.json", "w") as f:
        json.dump([r.to_dict() for r in results], f, indent=2)
    print(f"💾 Detailed results saved to: test_results_option_a.json")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
