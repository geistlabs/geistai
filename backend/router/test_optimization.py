#!/usr/bin/env python3
"""Quick optimization validation test"""

import httpx
import asyncio
import json
import time


async def test_optimized_query():
    """Test a single weather query with timing"""

    query = "What is the weather in Paris?"

    print(f"🧪 Testing optimized query: {query}\n")

    start_time = time.time()

    async with httpx.AsyncClient(timeout=45) as client:
        response_text = ""
        tokens = 0

        async with client.stream(
            "POST",
            "http://localhost:8000/api/chat/stream",
            json={"message": query, "messages": []},
            headers={"Content-Type": "application/json"}
        ) as response:

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])

                        if "token" in data:
                            response_text += data["token"]
                            tokens += 1
                            if tokens <= 5:
                                print(f"   Token {tokens}: {repr(data['token'])}")

                        elif "finished" in data and data["finished"]:
                            break

                    except json.JSONDecodeError:
                        continue

        elapsed = time.time() - start_time

        print(f"\n✅ Complete!")
        print(f"⏱️  Time: {elapsed:.1f}s (baseline was 68.9s)")
        print(f"📊 Tokens: {tokens} (baseline was ~125)")
        print(f"📈 Improvement: {((68.9 - elapsed) / 68.9 * 100):.0f}% faster")
        print(f"\n📝 Response Preview:")
        print(f"{response_text[:250]}...")

        return {
            "time": elapsed,
            "tokens": tokens,
            "response": response_text,
            "baseline_time": 68.9,
            "improvement_pct": ((68.9 - elapsed) / 68.9 * 100)
        }


if __name__ == "__main__":
    result = asyncio.run(test_optimized_query())

    print(f"\n{'='*60}")
    print(f"OPTIMIZATION RESULTS")
    print(f"{'='*60}")
    print(f"Before: 68.9s, ~125 tokens")
    print(f"After:  {result['time']:.1f}s, {result['tokens']} tokens")
    print(f"Speed:  {result['improvement_pct']:.0f}% faster")
    print(f"{'='*60}")
