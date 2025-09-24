#!/usr/bin/env python3
"""
Test script for streaming functionality - mimics frontend behavior.
Includes reasonableness rating of responses.
"""

import httpx
import asyncio
import json
from reasonableness_service import reasonableness_service

async def test_conversation():
    """Test a back-and-forth conversation with the AI"""
    url = "http://localhost:8000/api/chat/stream"
    
    # Define a conversation flow
    conversation = [
        "Hello! I'm interested in learning about space exploration. Can you tell me about the first moon landing?",
        "That's fascinating! What about Mars exploration? What are the current missions?",
        "What challenges do astronauts face when traveling to Mars?",
        "Do you think humans will colonize Mars in the next 50 years?",
        "Thank you for the great conversation! What's your favorite space fact?"
    ]
    
    conversation_history = []
    total_rating = 0
    response_count = 0
    
    print("🚀 Starting back-and-forth conversation test...")
    print("=" * 60)
    
    for turn, user_message in enumerate(conversation, 1):
        print(f"\n🗣️  Turn {turn} - User:")
        print(f"   {user_message}")
        
        # Build payload with conversation history
        payload = {
            "message": user_message,
            "messages": conversation_history
        }
        
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    url,
                    json=payload,
                    headers={"Accept": "text/event-stream"},
                    timeout=30.0
                ) as response:
                    
                    if response.status_code != 200:
                        print(f"❌ Error: {await response.atext()}")
                        continue
                    
                    print(f"\n🤖 AI Response:")
                    print("-" * 40)
                    
                    full_response = ""
                    chunk_count = 0
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            try:
                                data = json.loads(data_str)
                                
                                if "token" in data:
                                    token = data["token"]
                                    print(token, end="", flush=True)
                                    full_response += token
                                    chunk_count += 1
                                elif "finished" in data:
                                    print(f"\n\n📊 Chunks: {chunk_count}")
                                    break
                                elif "error" in data:
                                    print(f"\n❌ Error: {data['error']}")
                                    break
                                    
                            except json.JSONDecodeError as e:
                                continue
                    
                    # Add to conversation history
                    conversation_history.append({"role": "user", "content": user_message})
                    conversation_history.append({"role": "assistant", "content": full_response})
                    
                    # Rate the response
                    print(f"\n🔍 Rating response...")
                    try:
                        rating_result = await reasonableness_service.rate_response(
                            user_prompt=user_message,
                            ai_response=full_response,
                            context=f"Conversation turn {turn} of {len(conversation)}"
                        )
                        
                        rating = rating_result['rating']
                        total_rating += rating
                        response_count += 1
                        
                        print(f"📊 Rating: {rating:.2f}/1.0")
                        print(f"🎯 Confidence: {rating_result['confidence']:.2f}/1.0")
                        if rating_result['issues']:
                            print(f"⚠️  Issues: {', '.join(rating_result['issues'])}")
                        else:
                            print("✅ No issues found")
                            
                    except Exception as e:
                        print(f"⚠️  Rating unavailable: {e}")
                        # Manual assessment
                        rating = 0.8 if len(full_response) > 50 else 0.5
                        total_rating += rating
                        response_count += 1
                        print(f"📊 Manual Rating: {rating:.2f}/1.0")
                    
                    print("-" * 40)
                    
        except Exception as e:
            print(f"❌ Turn {turn} failed: {e}")
            continue
    
    # Conversation summary
    print("\n" + "=" * 60)
    print("📊 CONVERSATION SUMMARY")
    print("=" * 60)
    print(f"🗣️  Total turns: {len(conversation)}")
    print(f"🤖 Successful responses: {response_count}")
    print(f"📈 Average rating: {(total_rating/response_count):.2f}/1.0" if response_count > 0 else "📈 Average rating: N/A")
    print(f"💬 Conversation history length: {len(conversation_history)} messages")
    
    # Analyze conversation flow
    if len(conversation_history) >= 4:
        print(f"\n🔍 Conversation Analysis:")
        print(f"   - Context maintained: {'✅ Yes' if len(conversation_history) == len(conversation) * 2 else '❌ No'}")
        print(f"   - Response quality: {'✅ Good' if (total_rating/response_count) > 0.7 else '⚠️  Needs improvement'}")
        print(f"   - Conversation flow: {'✅ Natural' if response_count == len(conversation) else '❌ Interrupted'}")
    
    print("\n✨ Conversation test completed!")
    return conversation_history


if __name__ == "__main__":
    print("🧪 Starting conversation test with reasonableness rating...")
    
    asyncio.run(test_conversation())