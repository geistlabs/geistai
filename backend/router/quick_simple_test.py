#!/usr/bin/env python3
import asyncio
import httpx
import time
import json

async def test_simple_query(query, test_num):
    print(f"\nTest {test_num}: {query[:40]}...")
    
    start = time.time()
    first_token_time = None
    tokens = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream(
            "POST",
            "http://localhost:8000/api/chat/stream",
            json={"message": query, "messages": []}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if "token" in data:
                            if first_token_time is None:
                                first_token_time = time.time() - start
                            tokens.append(data["token"])
                        elif "finished" in data and data["finished"]:
                            break
                    except json.JSONDecodeError:
                        continue
    
    total_time = time.time() - start
    response = "".join(tokens)
    
    print(f"   ✅ {total_time:.2f}s (first token: {first_token_time:.2f}s)")
    
    return {"query": query, "total_time": total_time, "first_token_time": first_token_time}

async def main():
    queries = [
        "What is 2+2?",
        "Write a haiku about coding",
        "What is Docker?",
        "Tell me a joke",
        "Explain what an API is",
        "What is Python?",
        "How are you doing today?",
        "What's the capital of France?"
    ]
    
    print("\n🧪 Running 8 Simple Query Tests (Llama)")
    print("="*60)
    
    results = []
    for i, query in enumerate(queries, 1):
        result = await test_simple_query(query, i)
        results.append(result)
        await asyncio.sleep(1)
    
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    
    total_times = [r["total_time"] for r in results]
    first_token_times = [r["first_token_time"] for r in results]
    
    print(f"\nStatistics:")
    print(f"  Avg Total:       {sum(total_times)/len(total_times):.2f}s")
    print(f"  Min Total:       {min(total_times):.2f}s")
    print(f"  Max Total:       {max(total_times):.2f}s")
    print(f"  Avg First Token: {sum(first_token_times)/len(first_token_times):.2f}s")
    print(f"  Min First Token: {min(first_token_times):.2f}s")
    print(f"  Max First Token: {max(first_token_times):.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
