"""
Tool Calling Test Suite - Validate LLM Reliability

Run this against any model to validate it works in your system
before committing to deployment.

Usage:
    python test_tool_calling.py --model gpt-oss-20b
    python test_tool_calling.py --model qwen-32b
    python test_tool_calling.py --compare baseline.json qwen.json
"""

import asyncio
import httpx
import json
import time
from typing import Dict, List, Any
from datetime import datetime
import argparse


# ============================================================================
# TEST CASES
# ============================================================================

TEST_CASES = {
    # Core use cases
    "weather_simple": {
        "query": "What's the weather in Paris, France?",
        "expected_tools": ["brave_web_search", "fetch"],
        "max_time": 15,
        "must_have_keywords": ["paris", "temperature", "weather"],
        "priority": "critical",
    },
    "weather_multiple": {
        "query": "Compare the weather in London and Tokyo",
        "expected_tools": ["brave_web_search", "fetch"],
        "max_time": 25,
        "must_have_keywords": ["london", "tokyo", "temperature"],
        "priority": "high",
    },
    "news_current": {
        "query": "What's the latest news about artificial intelligence?",
        "expected_tools": ["brave_web_search"],
        "max_time": 20,
        "must_have_keywords": ["ai", "news"],
        "priority": "critical",
    },

    # Simple queries (no tools)
    "creative_haiku": {
        "query": "Write a haiku about coding",
        "expected_tools": [],
        "max_time": 5,
        "must_have_keywords": ["haiku"],
        "priority": "critical",
    },
    "simple_math": {
        "query": "What is 2+2?",
        "expected_tools": [],
        "max_time": 3,
        "must_have_keywords": ["4"],
        "priority": "critical",
    },
    "simple_explanation": {
        "query": "Explain what Docker is in one sentence",
        "expected_tools": [],
        "max_time": 5,
        "must_have_keywords": ["docker", "container"],
        "priority": "high",
    },

    # Edge cases
    "ambiguous_location": {
        "query": "What's the weather like?",
        "expected_tools": ["brave_web_search"],
        "max_time": 20,
        "must_have_keywords": ["weather"],
        "allow_clarification": True,
        "priority": "medium",
    },
    "no_results": {
        "query": "What's the weather on Mars?",
        "expected_tools": ["brave_web_search"],
        "max_time": 20,
        "must_have_keywords": ["mars"],
        "allow_no_data": True,
        "priority": "medium",
    },
    "very_long": {
        "query": "Tell me about the weather in Paris " + "and also tell me more about it " * 20,
        "expected_tools": ["brave_web_search", "fetch"],
        "max_time": 25,
        "must_have_keywords": ["paris", "weather"],
        "priority": "low",
    },

    # Multi-step reasoning
    "chained_tools": {
        "query": "Find a weather website for London and tell me what it says",
        "expected_tools": ["brave_web_search", "fetch"],
        "max_time": 20,
        "must_have_keywords": ["london", "weather"],
        "priority": "high",
    },
}


# ============================================================================
# TEST EXECUTION
# ============================================================================

class ToolCallingTester:
    """Test tool calling behavior of LLMs"""

    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
        self.client = httpx.AsyncClient(timeout=120.0)

    async def run_single_test(
        self,
        test_name: str,
        test_case: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run a single test case"""

        print(f"\n{'='*60}")
        print(f"🧪 Testing: {test_name}")
        print(f"   Query: {test_case['query'][:60]}...")
        print(f"{'='*60}")

        start_time = time.time()
        result = {
            "test_name": test_name,
            "query": test_case["query"],
            "priority": test_case["priority"],
            "timestamp": datetime.now().isoformat(),
        }

        try:
            # Send request
            response_content = ""
            chunks_received = 0
            tools_called = []

            print(f"📡 Sending request to {self.api_url}...")

            async with self.client.stream(
                "POST",
                f"{self.api_url}/api/chat/stream",
                json={
                    "message": test_case["query"],
                    "messages": []
                }
            ) as response:

                print(f"📥 Response status: {response.status_code}")

                if response.status_code != 200:
                    result["error"] = f"HTTP {response.status_code}"
                    result["passed"] = False
                    return result

                print(f"⏳ Streaming response (timeout in {test_case['max_time']}s)...")
                last_update = time.time()

                async for line in response.aiter_lines():
                    # Show progress every 5 seconds
                    if time.time() - last_update > 5:
                        elapsed_so_far = time.time() - start_time
                        print(f"   ... still streaming ({elapsed_so_far:.1f}s elapsed, {chunks_received} chunks, {len(response_content)} chars)")
                        last_update = time.time()

                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])

                            if "token" in data:
                                response_content += data["token"]
                                chunks_received += 1
                                # Show first few tokens
                                if chunks_received <= 3:
                                    print(f"   🔤 Token {chunks_received}: '{data['token']}'")

                            elif "finished" in data and data["finished"]:
                                print(f"✅ Stream finished")
                                break

                            elif "error" in data:
                                print(f"❌ Error in stream: {data['error']}")
                                result["error"] = data["error"]
                                break

                        except json.JSONDecodeError:
                            continue

            elapsed = time.time() - start_time

            # Populate result
            result["response_content"] = response_content
            result["content_length"] = len(response_content)
            result["chunks_received"] = chunks_received
            result["elapsed_time"] = elapsed

            # Run validation checks
            checks = self.validate_response(test_case, result)
            result["checks"] = checks
            result["passed"] = all(checks.values())

            # Print summary
            status = "✅ PASSED" if result["passed"] else "❌ FAILED"
            print(f"\n{status} in {elapsed:.1f}s")
            print(f"Content preview: {response_content[:150]}...")

            if not result["passed"]:
                print(f"Failed checks:")
                for check, passed in checks.items():
                    if not passed:
                        print(f"  ❌ {check}")

        except Exception as e:
            elapsed = time.time() - start_time
            result["error"] = str(e)
            result["elapsed_time"] = elapsed
            result["passed"] = False
            print(f"❌ EXCEPTION after {elapsed:.1f}s: {e}")
            import traceback
            traceback.print_exc()

        return result

    def validate_response(
        self,
        test_case: Dict[str, Any],
        result: Dict[str, Any]
    ) -> Dict[str, bool]:
        """Validate response meets requirements"""

        content = result.get("response_content", "").lower()
        elapsed = result.get("elapsed_time", 999)

        checks = {}

        # Check 1: Response generated
        checks["response_generated"] = bool(content) and len(content) > 10

        # Check 2: Within time limit
        checks["within_time_limit"] = elapsed < test_case["max_time"]

        # Check 3: Contains required keywords
        if "must_have_keywords" in test_case:
            keywords_found = [
                kw for kw in test_case["must_have_keywords"]
                if kw.lower() in content
            ]
            checks["has_required_keywords"] = len(keywords_found) >= len(test_case["must_have_keywords"]) * 0.5
            checks["keyword_coverage"] = len(keywords_found) / len(test_case["must_have_keywords"])

        # Check 4: Not a timeout/error message
        checks["not_error_message"] = not any([
            "error" in content,
            "timeout" in content,
            "failed" in content and "success" not in content,
        ])

        # Check 5: Reasonable length (not too short)
        if test_case.get("expected_tools"):
            checks["reasonable_length"] = len(content) > 50
        else:
            checks["reasonable_length"] = len(content) > 20

        return checks

    async def run_all_tests(self, filter_priority: str = None) -> Dict[str, Any]:
        """Run all test cases"""

        print(f"\n{'#'*60}")
        print(f"# Tool Calling Test Suite")
        print(f"# Testing: {self.api_url}")
        print(f"# Time: {datetime.now()}")
        print(f"{'#'*60}\n")

        results = {}

        # Filter by priority if specified
        tests_to_run = TEST_CASES
        if filter_priority:
            tests_to_run = {
                k: v for k, v in TEST_CASES.items()
                if v["priority"] == filter_priority
            }

        print(f"📋 Running {len(tests_to_run)} tests (priority: {filter_priority or 'all'})")
        print(f"   Tests: {', '.join(tests_to_run.keys())}\n")

        for i, (test_name, test_case) in enumerate(tests_to_run.items(), 1):
            print(f"\n[{i}/{len(tests_to_run)}] Starting test: {test_name}")
            result = await self.run_single_test(test_name, test_case)
            results[test_name] = result

            # Show running summary
            passed_so_far = sum(1 for r in results.values() if r.get("passed", False))
            print(f"   Running score: {passed_so_far}/{i} passed ({passed_so_far/i:.1%})")

            # Small delay between tests
            print(f"   ⏸️  Waiting 2s before next test...")
            await asyncio.sleep(2)

        return results

    async def close(self):
        """Cleanup"""
        await self.client.aclose()


# ============================================================================
# RESULTS ANALYSIS
# ============================================================================

def analyze_results(results: Dict[str, Any]) -> Dict[str, Any]:
    """Generate summary statistics"""

    total = len(results)
    passed = sum(1 for r in results.values() if r.get("passed", False))
    failed = total - passed

    # By priority
    critical_tests = [r for r in results.values() if r["priority"] == "critical"]
    critical_passed = sum(1 for r in critical_tests if r.get("passed", False))

    # Latency stats
    latencies = [r["elapsed_time"] for r in results.values() if "elapsed_time" in r]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0

    # Tool vs non-tool queries
    tool_queries = [r for r in results.values() if TEST_CASES[r["test_name"]].get("expected_tools")]
    tool_success = sum(1 for r in tool_queries if r.get("passed", False))
    tool_success_rate = tool_success / len(tool_queries) if tool_queries else 0

    simple_queries = [r for r in results.values() if not TEST_CASES[r["test_name"]].get("expected_tools")]
    simple_success = sum(1 for r in simple_queries if r.get("passed", False))
    simple_success_rate = simple_success / len(simple_queries) if simple_queries else 0

    summary = {
        "total_tests": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": passed / total if total > 0 else 0,
        "critical_pass_rate": critical_passed / len(critical_tests) if critical_tests else 0,
        "avg_latency": avg_latency,
        "p95_latency": p95_latency,
        "tool_query_success_rate": tool_success_rate,
        "simple_query_success_rate": simple_success_rate,
        "timestamp": datetime.now().isoformat(),
    }

    return summary


def print_summary(results: Dict[str, Any], summary: Dict[str, Any]):
    """Print test summary"""

    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}\n")

    print(f"Overall Results:")
    print(f"  Total Tests:     {summary['total_tests']}")
    print(f"  Passed:          {summary['passed']} ({summary['pass_rate']:.1%})")
    print(f"  Failed:          {summary['failed']}")
    print(f"  Critical Pass:   {summary['critical_pass_rate']:.1%}")

    print(f"\nPerformance:")
    print(f"  Avg Latency:     {summary['avg_latency']:.1f}s")
    print(f"  P95 Latency:     {summary['p95_latency']:.1f}s")

    print(f"\nBy Query Type:")
    print(f"  Tool Queries:    {summary['tool_query_success_rate']:.1%} success")
    print(f"  Simple Queries:  {summary['simple_query_success_rate']:.1%} success")

    # Show failures
    failures = [r for r in results.values() if not r.get("passed", False)]
    if failures:
        print(f"\n❌ Failed Tests:")
        for f in failures:
            print(f"  - {f['test_name']}: {f.get('error', 'validation failed')}")

    # Validation gates
    print(f"\n{'='*60}")
    print(f"VALIDATION GATES")
    print(f"{'='*60}\n")

    gates = {
        "Tool Query Success >85%": summary['tool_query_success_rate'] > 0.85,
        "Simple Query Success >95%": summary['simple_query_success_rate'] > 0.95,
        "Avg Latency <15s": summary['avg_latency'] < 15,
        "Critical Tests Pass 100%": summary['critical_pass_rate'] == 1.0,
    }

    all_passed = all(gates.values())

    for gate, passed in gates.items():
        status = "✅" if passed else "❌"
        print(f"{status} {gate}")

    print(f"\n{'='*60}")
    if all_passed:
        print(f"✅ ALL VALIDATION GATES PASSED - Model is ready!")
    else:
        print(f"❌ VALIDATION FAILED - Do not deploy this model")
    print(f"{'='*60}\n")


def compare_results(baseline: Dict, candidate: Dict):
    """Compare two test runs"""

    print(f"\n{'='*60}")
    print(f"COMPARISON REPORT")
    print(f"{'='*60}\n")

    baseline_summary = analyze_results(baseline)
    candidate_summary = analyze_results(candidate)

    metrics = [
        ("Pass Rate", "pass_rate", "%"),
        ("Tool Success", "tool_query_success_rate", "%"),
        ("Simple Success", "simple_query_success_rate", "%"),
        ("Avg Latency", "avg_latency", "s"),
        ("P95 Latency", "p95_latency", "s"),
    ]

    print(f"{'Metric':<20} {'Baseline':>12} {'Candidate':>12} {'Δ':>12}")
    print(f"{'-'*60}")

    for label, key, unit in metrics:
        base_val = baseline_summary[key]
        cand_val = candidate_summary[key]

        if unit == "%":
            delta = (cand_val - base_val) * 100
            print(f"{label:<20} {base_val:>11.1%} {cand_val:>11.1%} {delta:>+10.1f}%")
        else:
            delta = cand_val - base_val
            print(f"{label:<20} {base_val:>10.1f}{unit} {cand_val:>10.1f}{unit} {delta:>+9.1f}{unit}")

    # Recommendation
    print(f"\n{'='*60}")
    if candidate_summary["pass_rate"] > baseline_summary["pass_rate"] * 1.1:
        print(f"✅ RECOMMENDED: Switch to candidate model")
    elif candidate_summary["pass_rate"] > baseline_summary["pass_rate"]:
        print(f"⚠️  MARGINAL: Candidate slightly better, validate more")
    else:
        print(f"❌ NOT RECOMMENDED: Candidate worse than baseline")
    print(f"{'='*60}\n")


# ============================================================================
# MAIN
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description="Test LLM tool calling")
    parser.add_argument("--model", default="current", help="Model name for logging")
    parser.add_argument("--url", default="http://localhost:8000", help="API URL")
    parser.add_argument("--output", default="test_results.json", help="Output file")
    parser.add_argument("--priority", choices=["critical", "high", "medium", "low"],
                       help="Only run tests of this priority")
    parser.add_argument("--compare", nargs=2, metavar=("BASELINE", "CANDIDATE"),
                       help="Compare two result files")

    args = parser.parse_args()

    # Comparison mode
    if args.compare:
        with open(args.compare[0]) as f:
            baseline = json.load(f)
        with open(args.compare[1]) as f:
            candidate = json.load(f)

        compare_results(baseline["results"], candidate["results"])
        return

    # Test mode
    tester = ToolCallingTester(api_url=args.url)

    try:
        results = await tester.run_all_tests(filter_priority=args.priority)
        summary = analyze_results(results)

        # Print summary
        print_summary(results, summary)

        # Save results
        output = {
            "model": args.model,
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "summary": summary,
        }

        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)

        print(f"\n💾 Results saved to: {args.output}")

        # Exit code based on validation
        if summary["critical_pass_rate"] == 1.0 and summary["pass_rate"] > 0.85:
            exit(0)  # Success
        else:
            exit(1)  # Validation failed

    finally:
        await tester.close()


if __name__ == "__main__":
    asyncio.run(main())
