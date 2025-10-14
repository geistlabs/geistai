#!/usr/bin/env python3
"""
Test Production Deployment via Port-Forward
Tests the development namespace deployment on production GPUs
"""

import httpx
import asyncio
import json
import time
from datetime import datetime


async def test_query(query: str, max_time: int = 30):
    """Test a single query against production"""
    print(f"\n{'─'*80}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🧪 Testing: {query}")
    print(f"─────────────────────────────────────────────────────────────────")

    start_time = time.time()
    first_token_time = None
    tokens = 0

    try:
        async with httpx.AsyncClient(timeout=max_time) as client:
            response = await client.post(
                "http://localhost:8000/api/chat/stream",
                json={"message": query, "messages": []},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                print(f"❌ HTTP {response.status_code}")
                return {"success": False, "time": time.time() - start_time}

            response_text = ""

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if "token" in data:
                            if first_token_time is None:
                                first_token_time = time.time() - start_time
                                print(f"   ⚡ First token: {first_token_time:.2f}s")
                            response_text += data["token"]
                            tokens += 1
                        elif "finished" in data:
                            break
                    except json.JSONDecodeError:
                        continue

            total_time = time.time() - start_time
            tok_per_sec = tokens / total_time if total_time > 0 else 0

            print(f"   ⏱️  Total time: {total_time:.2f}s")
            print(f"   📊 Tokens: {tokens} ({tok_per_sec:.1f} tok/s)")
            print(f"   📝 Response: {response_text[:100]}...")

            return {
                "success": True,
                "time": total_time,
                "first_token": first_token_time,
                "tokens": tokens
            }

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"   ❌ {type(e).__name__}: {str(e)[:100]}")
        return {"success": False, "time": elapsed}


async def main():
    print("\n" + "="*80)
    print("🚀 Testing Production Deployment (Development Namespace)")
    print("="*80)
    print("Environment: 4x NVIDIA RTX 4000 Ada (20GB each)")
    print("Model: GPT-OSS 20B (Q4_K_S)")
    print("Architecture: Orchestrator with agent tools")
    print("="*80)

    test_cases = [
        ("What is 2+2?", 10),
        ("Tell me a joke", 15),
        ("Write a haiku about coding", 15),
        ("What is Docker?", 20),
        ("Explain what an API is", 25),
    ]

    results = []

    for query, max_time in test_cases:
        result = await test_query(query, max_time)
        results.append(result)
        await asyncio.sleep(2)

    # Summary
    print("\n" + "="*80)
    print("📊 SUMMARY")
    print("="*80)

    passed = sum(1 for r in results if r["success"])
    total = len(results)

    print(f"\n✅ Passed: {passed}/{total} ({passed/total*100:.0f}%)")

    if passed > 0:
        successful = [r for r in results if r["success"]]
        times = [r["time"] for r in successful]
        first_tokens = [r["first_token"] for r in successful if r.get("first_token")]

        print(f"\n⏱️  Response Time:")
        print(f"   Average: {sum(times)/len(times):.2f}s")
        print(f"   Fastest: {min(times):.2f}s")
        print(f"   Slowest: {max(times):.2f}s")

        if first_tokens:
            print(f"\n⚡ First Token:")
            print(f"   Average: {sum(first_tokens)/len(first_tokens):.2f}s")
            print(f"   Fastest: {min(first_tokens):.2f}s")

    print("\n" + "="*80)


if __name__ == "__main__":
    asyncio.run(main())
