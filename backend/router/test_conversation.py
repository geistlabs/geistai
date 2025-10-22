#!/usr/bin/env python3
"""
Test script for streaming functionality - mimics frontend behavior.
Includes reasonableness rating of responses.
"""

import time
import httpx
import asyncio
import json
import sys
from reasonableness_service import reasonableness_service
from initial_test_cases import  long_conversations


async def evaluate_response(user_question: str, ai_response: str, turn_number: int, elapsed_time: float) -> dict:
    """
    Evaluate an AI response for quality and reasonableness

    Args:
        user_question: The question asked by the user
        ai_response: The AI's response
        turn_number: The turn number in the conversation

    Returns:
        dict: Evaluation results with ratings and analysis
    """
    # Get reasonableness rating
    try:
        rating_result = await reasonableness_service.rate_response(
            user_prompt=user_question,
            ai_response=ai_response,
            context=f"Conversation turn {turn_number}"
        )
        reasonableness_rating = rating_result['rating']
        issues = rating_result.get('issues', [])
    except Exception as e:
        print(f"⚠️  Reasonableness rating unavailable: {e}")
        reasonableness_rating = 0.7  # Default rating
        issues = []

    # Additional quality checks
    if len(ai_response) < 50:
        issues.append("Response too short")
    elif len(ai_response) > 1000:
        issues.append("Response too long")

    if not ai_response.strip():
        issues.append("Empty response")
        reasonableness_rating = 0.0

    return {
        'reasonableness_rating': reasonableness_rating,
        'issues': issues,
        'response_length': len(ai_response),
        'elapsed_time': elapsed_time

    }

async def test_parallel_conversation(long_conversations):
    """Run multiple conversations with a max of 3 in parallel"""
    print(f"🔄 Running {len(long_conversations)} conversations with concurrency=3...")

    semaphore = asyncio.Semaphore(len(long_conversations))

    async def run_with_limit(idx: int, conversation):
        async with semaphore:
            try:
                result = await test_conversation(conversation)
                print(f"✅ Conversation {idx+1} completed successfully")
                return result
            except Exception as e:
                print(f"❌ Conversation {idx+1} failed: {e}")
                return e

    tasks = [asyncio.create_task(run_with_limit(i, conv)) for i, conv in enumerate(long_conversations)]

    try:
        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = len(results) - successful

        print(f"\n📊 Results: {successful} successful, {failed} failed")

    except Exception as e:
        print(f"❌ Error in parallel execution: {e}")
        raise


async def test_conversation(conversation_turns):
    """Test a multi-turn conversation with evaluation and adaptive questioning"""
    url = f"http://localhost:8000/api/stream"
    
    if not conversation_turns:
        print("⚠️ No conversation turns provided")
        return None
    
    # Define conversation turns with next questions
   
    
    conversation_history = []
    total_rating = 0
    response_count = 0
    evaluation_results = []
    

    for turn, turn_data in enumerate(conversation_turns, 1):
        user_message = turn_data
        print(f"User message: {user_message} Turn: {turn}")
    
        
        # Build payload with conversation history
        payload = {
            "message": user_message,
            "messages": conversation_history
        }
        print(f"Calling with Payload: {payload}")
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
                        print(f"❌ Error: {response.status_code}")
                        continue
          
                    full_response = ""
                    chunk_count = 0
                    start_time = time.time()
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            try:
                                data = json.loads(data_str)
                                
                                # Handle different event types from the new streaming endpoint
                                if data.get("type") == "orchestrator_token":
                                    token = data.get("data", {}).get("content", "")
                                    if token:
                                        full_response += token
                                        chunk_count += 1
                                elif data.get("type") == "sub_agent_event":
                                    # Log sub-agent activity for debugging
                                    sub_agent_data = data.get("data", {})
                                    if sub_agent_data.get("type") == "agent_start":
                                        print(f"   🤖 Agent {sub_agent_data.get('data', {}).get('agent', 'unknown')} started")
                                    elif sub_agent_data.get("type") == "agent_complete":
                                        print(f"   ✅ Agent {sub_agent_data.get('data', {}).get('agent', 'unknown')} completed")
                                elif data.get("type") == "final_response":
                                    # Final response contains the complete text
                                    final_text = data.get("text", "")
                                    if final_text and not full_response:
                                        full_response = final_text
                                    break
                                elif data.get("type") == "error":
                                    print(f"\n❌ Error: {data.get('message', 'Unknown error')}")
                                    break
                                elif "finished" in data:
                                    break
                                    
                            except json.JSONDecodeError as e:
                                continue
                    
                    # Add to conversation history
                    conversation_history.append({"role": "user", "content": user_message})
                    print(f"Assistant response: {full_response}")
                    conversation_history.append({"role": "assistant", "content": full_response})
                    elapsed_time = time.time() - start_time
                    # Evaluate the response
                    evaluation = await evaluate_response(
                        user_question=user_message,
                        ai_response=full_response,
                        turn_number=turn,
                        elapsed_time=elapsed_time
                    )
                    
                    evaluation_results.append(evaluation)
                    total_rating += evaluation['reasonableness_rating']
                    response_count += 1
                    
                    # Display evaluation results
                    
                    if evaluation['issues']:
                        print(f"   ⚠️  Issues: {', '.join(evaluation['issues'])}")

                    

                    

        except httpx.TimeoutException as e:
            print(f"❌ Turn {turn} failed: {e}")
            continue
        except httpx.HTTPStatusError as e:
            print(f"❌ Turn {turn} failed: {e}")
            continue
        except Exception as e:
            print(f"❌ Turn {turn} failed: {e}")
            continue
    print(f"Conversation history: {conversation_history}")
    # Conversation summary
    print("\n" + "=" * 80)
    print("📊 CONVERSATION SUMMARY")
    print("=" * 80)
    print(f"🗣️  Total turns: {len(conversation_turns)}")
    print(f"🤖 Successful responses: {response_count}")
    print(f"📈 Average reasonableness rating: {(total_rating/response_count):.2f}/1.0" if response_count > 0 else "📈 Average rating: N/A")
    print(f"💬 Conversation history length: {len(conversation_history)} messages")
    avg_reasonableness = 0
    # Detailed analysis
    if evaluation_results:
        avg_reasonableness = sum(e['reasonableness_rating'] for e in evaluation_results) / len(evaluation_results)
        total_issues = sum(len(e['issues']) for e in evaluation_results)
        
        print(f"\n🔍 DETAILED ANALYSIS:")
        print(f"   🎯 Average reasonableness: {avg_reasonableness:.2f}/1.0")
        print(f"   ⚠️  Total issues found: {total_issues}")
        print(f"   📏 Average response length: {sum(e['response_length'] for e in evaluation_results) / len(evaluation_results):.0f} characters")
        
        # Turn-by-turn breakdown
        print(f"\n📋 TURN-BY-TURN BREAKDOWN:")
        for i, eval_result in enumerate(evaluation_results, 1):
            status = "✅" if eval_result['reasonableness_rating'] > 0.7 else "⚠️" if eval_result['reasonableness_rating'] > 0.5 else "❌"
            print(f"   Turn {i}: {status} {eval_result['reasonableness_rating']:.2f} (Quality: {eval_result['reasonableness_rating']:.2f})")
    
    # Analyze conversation flow
    if len(conversation_history) >= 4:
        print(f"\n🔍 CONVERSATION FLOW ANALYSIS:")
        print(f"   - Context maintained: {'✅ Yes' if len(conversation_history) == len(conversation_turns) * 2 else '❌ No'}")
        print(f"   - Response quality: {'✅ Good' if (total_rating/response_count) > 0.7 else '⚠️  Needs improvement'}")
        print(f"   - Conversation flow: {'✅ Natural' if response_count == len(conversation_turns) else '❌ Interrupted'}")
    
    print("\n✨ Multi-turn conversation test completed!")


    # INSERT_YOUR_CODE
    # Save the conversation and evaluation results to the database using SQLAlchemy models

    # Import here to avoid circular import issues
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from database import get_db_session, Conversation, ConversationResponse, ConversationResponseEvaluation, Issue

    # Open a new database session
    with get_db_session() as db:
        # Store the conversation as a Conversation row
        conversation_obj = Conversation(
            conversation_json=conversation_history
        )
        
        db.add(conversation_obj)
        db.flush()  # To get conversation_obj.id

        # Store each response and its evaluation
        for i, eval_result in enumerate(evaluation_results):
            # The response text is the AI's message at each turn (even indices in conversation_history, starting after user)
            response_message = conversation_history[i * 2 + 1] if (i * 2 + 1) < len(conversation_history) else {}
            response_text = response_message.get('content', '') if isinstance(response_message, dict) else str(response_message)
            response_obj = ConversationResponse(
                conversation_id=conversation_obj.internal_id,
                response=response_text,
                evaluation=eval_result.get('reasonableness_rating', 0),
                rationality=eval_result.get('reasonableness_rating', 0),  # Using same value for now
                coherency=eval_result.get('reasonableness_rating', 0),    # Using same value for now
                elapsed_time=eval_result.get('elapsed_time', 0)
            )
            db.add(response_obj)
            db.flush()  # To get response_obj.id

            # Store evaluation details
            evaluation_obj = ConversationResponseEvaluation(
                conversation_response_id=response_obj.id,
                conversation_json=eval_result,  # Store the full evaluation result as JSON
                elapsed=eval_result.get('elapsed_time', 0),
                rationality=eval_result.get('reasonableness_rating', 0),
                coherency=eval_result.get('reasonableness_rating', 0)
            )
            issues = eval_result.get('issues', [])
            issuesObj = Issue(
                conversation_response_id=response_obj.id,
                description=issues
            )
            db.add(issuesObj)
            db.add(evaluation_obj)

        db.commit()
    return {
        'conversation_history': conversation_history,
        'evaluation_results': evaluation_results,
        'summary': {
            'total_turns': len(conversation_turns),
            'successful_responses': response_count,
            'average_rating': total_rating/response_count if response_count > 0 else 0,
            'average_reasonableness': avg_reasonableness if evaluation_results else 0
        }
    }


async def main():
    """Main function to run the conversation tests"""
    try:
        # Check command line arguments
        if len(sys.argv) > 1:
            if sys.argv[1] == "--help" or sys.argv[1] == "-h":
                print("Usage: python test_conversation.py [options]")
                print("Options:")
                print("  --help, -h     Show this help message")
                print("  --single       Run a single conversation test")
                print("  --long         Run long conversations instead of short ones")
                return
            elif sys.argv[1] == "--single":
                print("🚀 Running single conversation test...")
                await test_conversation(long_conversations[0])
                print("✅ Single conversation test completed!")
                return
            elif sys.argv[1] == "--long":
                print("🚀 Starting long conversation tests...")
                print(f"📋 Running {len(long_conversations)} long conversation(s)")
                # Run long conversations
                tasks = [asyncio.create_task(test_conversation(conversation)) for conversation in long_conversations]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                successful = sum(1 for r in results if not isinstance(r, Exception))
                failed = len(results) - successful
                print(f"📊 Results: {successful} successful, {failed} failed")
                return
        
        # Default: run short conversations in parallel
        print("🚀 Starting conversation tests...")
        print(f"📋 Running {len(long_conversations)} conversation(s)")
        await test_parallel_conversation(long_conversations)
        print("✅ All conversation tests completed!")
        
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())