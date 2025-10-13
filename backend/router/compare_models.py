#!/usr/bin/env python3
"""
Compare GPT-OSS 20B vs Llama 3.1 8B for answer generation
Side-by-side validation test
"""
import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Dict, List, Any
import re

# Test queries covering all use cases
TEST_QUERIES = [
    # Answer mode (post-tool execution simulation)
    {
        "query": "What is the weather in Paris?",
        "findings": "Current weather in Paris: 12°C, partly cloudy, light rain expected. Humidity 75%, Wind 15km/h NW. Source: https://www.accuweather.com/en/fr/paris/623/weather-forecast/623",
        "category": "Answer Mode",
        "expect_sources": True
    },
    {
        "query": "Latest AI news",
        "findings": "OpenAI released GPT-4 Turbo with 128K context. Google announced Gemini Ultra. Meta released Llama 3.1. Source: https://techcrunch.com/ai-news",
        "category": "Answer Mode",
        "expect_sources": True
    },

    # Creative queries (direct)
    {
        "query": "Tell me a programming joke",
        "findings": None,
        "category": "Creative",
        "expect_sources": False
    },
    {
        "query": "Write a haiku about coding",
        "findings": None,
        "category": "Creative",
        "expect_sources": False
    },
    {
        "query": "Create a short story about a robot learning to paint",
        "findings": None,
        "category": "Creative",
        "expect_sources": False
    },

    # Simple knowledge (direct)
    {
        "query": "What is Docker?",
        "findings": None,
        "category": "Knowledge",
        "expect_sources": False
    },
    {
        "query": "Explain how HTTP works",
        "findings": None,
        "category": "Knowledge",
        "expect_sources": False
    },
    {
        "query": "What is machine learning?",
        "findings": None,
        "category": "Knowledge",
        "expect_sources": False
    },

    # Math/Logic
    {
        "query": "What is 2+2?",
        "findings": None,
        "category": "Math",
        "expect_sources": False
    },
]

def check_artifacts(text: str) -> List[str]:
    """
    Check for Harmony format and other artifacts

    Returns:
        List of artifact types found
    """
    artifacts = []

    # Harmony format markers
    if "<|channel|>" in text or "<|message|>" in text or "<|end|>" in text:
        artifacts.append("Harmony markers")

    # Meta-commentary patterns
    meta_patterns = [
        r"We need to",
        r"The user (asks|wants|needs|provided)",
        r"Let'?s (check|browse|open|search)",
        r"Our task",
        r"I (need|should|must|will) (to )?",
        r"First,? (we|I)",
    ]

    for pattern in meta_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            artifacts.append("Meta-commentary")
            break

    # Hallucinated tool calls
    if 'to=browser' in text or '{"cursor"' in text or 'assistantanalysis' in text:
        artifacts.append("Hallucinated tools")

    # Channel transitions
    if 'analysis' in text.lower() and ('channel' in text or 'assistant' in text):
        artifacts.append("Channel transitions")

    return list(set(artifacts))  # Remove duplicates

async def test_model(
    url: str,
    query: str,
    model_name: str,
    findings: str = None,
    expect_sources: bool = False
) -> Dict[str, Any]:
    """
    Test a single query against a model

    Args:
        url: Model endpoint URL
        query: User query
        model_name: Name for display
        findings: Optional findings from tools (for answer mode)
        expect_sources: Whether response should include sources

    Returns:
        Dictionary with test results
    """
    print(f"\n{'='*70}")
    print(f"Testing: {model_name}")
    print(f"Query: {query}")
    if findings:
        print(f"Mode: Answer generation (with findings)")
    print(f"{'='*70}")

    # Construct messages
    if findings:
        # Answer mode: simulate post-tool execution
        messages = [
            {
                "role": "user",
                "content": f"{query}\n\nHere is relevant information:\n{findings}\n\nPlease provide a brief answer (2-3 sentences) and list the source URLs."
            }
        ]
    else:
        # Direct query
        messages = [{"role": "user", "content": query}]

    start = time.time()
    response_text = ""
    first_token_time = None
    token_count = 0

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                f"{url}/v1/chat/completions",
                json={
                    "messages": messages,
                    "stream": True,
                    "max_tokens": 150,
                    "temperature": 0.7
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        if line.strip() == "data: [DONE]":
                            break
                        try:
                            data = json.loads(line[6:])
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    if first_token_time is None:
                                        first_token_time = time.time() - start
                                    response_text += delta["content"]
                                    token_count += 1
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        return {
            "model": model_name,
            "query": query,
            "error": str(e),
            "success": False
        }

    total_time = time.time() - start

    # Check for artifacts
    artifacts = check_artifacts(response_text)

    # Check for sources if expected
    has_sources = bool(re.search(r'(https?://|source|Source|\[\d\])', response_text))

    # Print results
    print(f"\n📄 Response:")
    print(response_text[:400])
    if len(response_text) > 400:
        print("...(truncated for display)")

    print(f"\n⏱️  Timing:")
    print(f"  First token: {first_token_time:.2f}s" if first_token_time else "  First token: N/A")
    print(f"  Total time:  {total_time:.2f}s")
    print(f"  Tokens:      {token_count}")
    print(f"  Length:      {len(response_text)} chars")

    print(f"\n🔍 Quality Checks:")
    if artifacts:
        print(f"  ❌ Artifacts: {', '.join(artifacts)}")
    else:
        print(f"  ✅ No artifacts detected")

    if expect_sources:
        if has_sources:
            print(f"  ✅ Sources included")
        else:
            print(f"  ⚠️  Missing sources (expected)")

    # Quality scoring
    quality_score = 0
    if not artifacts:
        quality_score += 5  # Clean (most important)
    if len(response_text) > 50:
        quality_score += 2  # Has content
    if expect_sources and has_sources:
        quality_score += 2  # Has sources when needed
    if total_time < 5:
        quality_score += 1  # Fast

    print(f"\n📊 Quality Score: {quality_score}/10")

    return {
        "model": model_name,
        "query": query,
        "category": None,  # Will be set by caller
        "response": response_text,
        "first_token_time": first_token_time,
        "total_time": total_time,
        "token_count": token_count,
        "artifacts": artifacts,
        "clean": len(artifacts) == 0,
        "has_sources": has_sources,
        "quality_score": quality_score,
        "success": True
    }

async def run_comparison():
    """Run full comparison between GPT-OSS and Llama"""
    print("🧪 GPT-OSS 20B vs Llama 3.1 8B - Comprehensive Comparison")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    # Model URLs
    GPTOSS_URL = "http://localhost:8082"
    LLAMA_URL = "http://localhost:8083"

    # Check if models are available
    print("\n🔍 Checking model availability...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                await client.get(f"{GPTOSS_URL}/health")
                print(f"  ✅ GPT-OSS 20B available at {GPTOSS_URL}")
            except:
                print(f"  ❌ GPT-OSS 20B not responding at {GPTOSS_URL}")
                print(f"     Please start it with: ./start-local-dev.sh")
                return

            try:
                await client.get(f"{LLAMA_URL}/health")
                print(f"  ✅ Llama 3.1 8B available at {LLAMA_URL}")
            except:
                print(f"  ❌ Llama 3.1 8B not responding at {LLAMA_URL}")
                print(f"     Please start it on port 8083 first")
                return
    except Exception as e:
        print(f"  ❌ Error checking models: {e}")
        return

    print("\n" + "="*70)
    print("Running tests...")
    print("="*70)

    results = []

    for i, test_case in enumerate(TEST_QUERIES, 1):
        print(f"\n\n{'#'*70}")
        print(f"# Test {i}/{len(TEST_QUERIES)}: {test_case['category']} - {test_case['query'][:50]}...")
        print(f"{'#'*70}")

        # Test GPT-OSS
        gptoss_result = await test_model(
            GPTOSS_URL,
            test_case["query"],
            "GPT-OSS 20B",
            test_case["findings"],
            test_case["expect_sources"]
        )
        gptoss_result["category"] = test_case["category"]
        results.append(gptoss_result)

        # Wait between tests
        await asyncio.sleep(2)

        # Test Llama
        llama_result = await test_model(
            LLAMA_URL,
            test_case["query"],
            "Llama 3.1 8B",
            test_case["findings"],
            test_case["expect_sources"]
        )
        llama_result["category"] = test_case["category"]
        results.append(llama_result)

        # Wait between test cases
        await asyncio.sleep(2)

    # Generate summary
    print("\n\n" + "="*70)
    print("📊 COMPREHENSIVE SUMMARY")
    print("="*70)

    gptoss_results = [r for r in results if r["model"] == "GPT-OSS 20B" and r.get("success")]
    llama_results = [r for r in results if r["model"] == "Llama 3.1 8B" and r.get("success")]

    # Overall stats
    print("\n🎯 Overall Statistics:")
    print(f"\n  GPT-OSS 20B:")
    print(f"    Tests completed:     {len(gptoss_results)}/{len(TEST_QUERIES)}")
    gptoss_clean = sum(1 for r in gptoss_results if r["clean"])
    print(f"    Clean responses:     {gptoss_clean}/{len(gptoss_results)} ({gptoss_clean/len(gptoss_results)*100:.0f}%)")
    gptoss_avg_time = sum(r["total_time"] for r in gptoss_results) / len(gptoss_results) if gptoss_results else 0
    print(f"    Avg response time:   {gptoss_avg_time:.2f}s")
    gptoss_avg_quality = sum(r["quality_score"] for r in gptoss_results) / len(gptoss_results) if gptoss_results else 0
    print(f"    Avg quality score:   {gptoss_avg_quality:.1f}/10")

    print(f"\n  Llama 3.1 8B:")
    print(f"    Tests completed:     {len(llama_results)}/{len(TEST_QUERIES)}")
    llama_clean = sum(1 for r in llama_results if r["clean"])
    print(f"    Clean responses:     {llama_clean}/{len(llama_results)} ({llama_clean/len(llama_results)*100:.0f}%)")
    llama_avg_time = sum(r["total_time"] for r in llama_results) / len(llama_results) if llama_results else 0
    print(f"    Avg response time:   {llama_avg_time:.2f}s")
    llama_avg_quality = sum(r["quality_score"] for r in llama_results) / len(llama_results) if llama_results else 0
    print(f"    Avg quality score:   {llama_avg_quality:.1f}/10")

    # Category breakdown
    print("\n📂 By Category:")
    categories = set(r["category"] for r in results if r.get("success"))

    for category in sorted(categories):
        print(f"\n  {category}:")
        cat_gptoss = [r for r in gptoss_results if r["category"] == category]
        cat_llama = [r for r in llama_results if r["category"] == category]

        if cat_gptoss:
            gptoss_cat_clean = sum(1 for r in cat_gptoss if r["clean"])
            print(f"    GPT-OSS:  {gptoss_cat_clean}/{len(cat_gptoss)} clean ({gptoss_cat_clean/len(cat_gptoss)*100:.0f}%)")

        if cat_llama:
            llama_cat_clean = sum(1 for r in cat_llama if r["clean"])
            print(f"    Llama:    {llama_cat_clean}/{len(cat_llama)} clean ({llama_cat_clean/len(cat_llama)*100:.0f}%)")

    # Artifact analysis
    print("\n🔍 Artifact Analysis:")
    all_gptoss_artifacts = [a for r in gptoss_results for a in r["artifacts"]]
    all_llama_artifacts = [a for r in llama_results for a in r["artifacts"]]

    from collections import Counter
    gptoss_artifact_counts = Counter(all_gptoss_artifacts)
    llama_artifact_counts = Counter(all_llama_artifacts)

    print(f"\n  GPT-OSS Artifacts:")
    if gptoss_artifact_counts:
        for artifact, count in gptoss_artifact_counts.most_common():
            print(f"    - {artifact}: {count} occurrences")
    else:
        print(f"    ✅ None detected")

    print(f"\n  Llama Artifacts:")
    if llama_artifact_counts:
        for artifact, count in llama_artifact_counts.most_common():
            print(f"    - {artifact}: {count} occurrences")
    else:
        print(f"    ✅ None detected")

    # Winner determination
    print("\n" + "="*70)
    print("🏆 WINNER DETERMINATION")
    print("="*70)

    print(f"\n  Metric                  | GPT-OSS 20B | Llama 3.1 8B | Winner")
    print(f"  ----------------------- | ----------- | ------------ | ----------")

    # Clean rate
    gptoss_clean_pct = gptoss_clean/len(gptoss_results)*100 if gptoss_results else 0
    llama_clean_pct = llama_clean/len(llama_results)*100 if llama_results else 0
    clean_winner = "Llama" if llama_clean_pct > gptoss_clean_pct else ("GPT-OSS" if gptoss_clean_pct > llama_clean_pct else "Tie")
    print(f"  Clean responses         | {gptoss_clean_pct:6.0f}%     | {llama_clean_pct:7.0f}%     | {clean_winner}")

    # Speed
    speed_winner = "Llama" if llama_avg_time < gptoss_avg_time else ("GPT-OSS" if gptoss_avg_time < llama_avg_time else "Tie")
    print(f"  Avg response time       | {gptoss_avg_time:6.2f}s     | {llama_avg_time:7.2f}s     | {speed_winner}")

    # Quality
    quality_winner = "Llama" if llama_avg_quality > gptoss_avg_quality else ("GPT-OSS" if gptoss_avg_quality > llama_avg_quality else "Tie")
    print(f"  Avg quality score       | {gptoss_avg_quality:6.1f}/10    | {llama_avg_quality:7.1f}/10    | {quality_winner}")

    # Overall
    print(f"\n✅ Overall Winner:")
    llama_wins = sum([
        llama_clean_pct > gptoss_clean_pct,
        llama_avg_time < gptoss_avg_time,
        llama_avg_quality > gptoss_avg_quality
    ])

    if llama_wins >= 2:
        print(f"  🏆 Llama 3.1 8B (wins {llama_wins}/3 metrics)")
        print(f"\n  ✅ RECOMMENDATION: Replace GPT-OSS with Llama 3.1 8B")
    elif llama_wins == 1:
        print(f"  🤝 Close call (Llama wins {llama_wins}/3 metrics)")
        print(f"\n  ⚠️  RECOMMENDATION: Review detailed results before deciding")
    else:
        print(f"  🏆 GPT-OSS 20B (wins {3-llama_wins}/3 metrics)")
        print(f"\n  ⚠️  RECOMMENDATION: Keep GPT-OSS, investigate further")

    # Save results
    output_file = f"/tmp/model_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n💾 Detailed results saved to: {output_file}")

    print("\n" + "="*70)
    print("✅ Comparison complete!")
    print("="*70)

if __name__ == "__main__":
    asyncio.run(run_comparison())
