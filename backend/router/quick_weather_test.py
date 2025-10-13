#!/usr/bin/env python3
import asyncio
import httpx
import time
import json

async def test_weather_query(city, test_num):
    print(f"\n{'='*60}")
    print(f"Test {test_num}: Weather in {city}")
    print(f"{'='*60}")
    
    start = time.time()
    first_token_time = None
    tokens = []
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            "http://localhost:8000/api/chat/stream",
            json={"message": f"What's the weather in {city}?", "messages": []}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if "token" in data:
                            if first_token_time is None:
                                first_token_time = time.time() - start
                                print(f"⚡ First token at: {first_token_time:.1f}s")
                            tokens.append(data["token"])
                        elif "finished" in data and data["finished"]:
                            break
                    except json.JSONDecodeError:
                        continue
    
    total_time = time.time() - start
    response = "".join(tokens)
    
    print(f"✅ Complete in {total_time:.1f}s")
    print(f"   First token: {first_token_time:.1f}s")
    print(f"   Response: {response[:100]}...")
    
    return {
        "city": city,
        "total_time": total_time,
        "first_token_time": first_token_time,
        "response_length": len(response)
    }

async def main():
    cities = ["Paris", "London", "Tokyo", "New York", "Berlin"]
    results = []
    
    print("\n🧪 Running 5 Weather Query Tests")
    print("="*60)
    
    for i, city in enumerate(cities, 1):
        result = await test_weather_query(city, i)
        results.append(result)
        await asyncio.sleep(2)  # Brief pause between tests
    
    # Summary
    print(f"\n\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    
    total_times = [r["total_time"] for r in results]
    first_token_times = [r["first_token_time"] for r in results if r["first_token_time"]]
    
    print(f"\nTotal Times:")
    for r in results:
        print(f"  {r['city']:12} {r['total_time']:6.1f}s")
    
    print(f"\nFirst Token Times:")
    for r in results:
        if r["first_token_time"]:
            print(f"  {r['city']:12} {r['first_token_time']:6.1f}s")
    
    print(f"\nStatistics:")
    print(f"  Avg Total:       {sum(total_times)/len(total_times):.1f}s")
    print(f"  Min Total:       {min(total_times):.1f}s")
    print(f"  Max Total:       {max(total_times):.1f}s")
    print(f"  Avg First Token: {sum(first_token_times)/len(first_token_times):.1f}s")
    print(f"  Min First Token: {min(first_token_times):.1f}s")
    print(f"  Max First Token: {max(first_token_times):.1f}s")

if __name__ == "__main__":
    asyncio.run(main())
