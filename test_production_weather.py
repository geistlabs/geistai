#!/usr/bin/env python3
import httpx, asyncio, json, time
from datetime import datetime

async def test():
    query = "What's the weather in Paris?"
    print(f"\n{'='*80}")
    print(f"🌤️  Weather Query - Production GPUs (4x RTX 4000 Ada)")
    print(f"{'='*80}\n")
    
    start = time.time()
    first_token = None
    tokens = 0
    
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📡 Sending: {query}")
            resp = await client.post("http://localhost:8001/api/stream",
                json={"message": query})
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Response {resp.status_code}\n")
            
            text = ""
            last_update = time.time()
            
            async for line in resp.aiter_lines():
                if time.time() - last_update > 5:
                    elapsed = time.time() - start
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⏳ {elapsed:.0f}s | {tokens} tokens")
                    last_update = time.time()
                
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        
                        # Handle orchestrator events
                        if data.get("type") == "orchestrator_token":
                            content = data.get("data", {}).get("content", "")
                            if first_token is None and content:
                                first_token = time.time() - start
                                print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚡ FIRST TOKEN: {first_token:.1f}s")
                            text += content
                            tokens += 1
                        
                        elif "finished" in data:
                            break
                            
                    except: pass
            
            total = time.time() - start
            print(f"\n{'='*80}")
            print(f"✅ COMPLETE")
            print(f"{'='*80}")
            print(f"⏱️  First token: {first_token:.1f}s" if first_token else "⏱️  No tokens")
            print(f"⏱️  Total: {total:.1f}s")
            print(f"📊 Tokens: {tokens}")
            if tokens > 0:
                print(f"⚡ Speed: {tokens/total:.1f} tok/s")
            print(f"\n📝 Response:\n{text[:400]}...")
            print(f"{'='*80}\n")
            
            if first_token and first_token < 10:
                print(f"🎉 EXCELLENT: Under 10s!")
            elif first_token and first_token < 20:
                print(f"✅ GOOD: Under 20s")
            elif first_token and first_token < 30:
                print(f"✅ ACCEPTABLE: Under 30s")
            else:
                print(f"⚠️  SLOW: Over 30s")
                
    except Exception as e:
        print(f"❌ Error: {e}")

asyncio.run(test())
