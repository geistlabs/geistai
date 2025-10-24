import asyncio
import httpx
import json
import re

async def test_weather_questions():
    questions = [
        'What is the current weather in New York City?',
        'What is the temperature in London right now?',
        'Is it raining in Tokyo today?',
        'What is the weather forecast for Paris this week?',
        'What is the humidity level in Sydney?',
        'What is the wind speed in Chicago?',
        'What is the weather like in Miami?',
        'What is the current temperature in Berlin?',
        'Is it sunny in Los Angeles?',
        'What is the weather forecast for Toronto?'
    ]
    
    print(f'🚀 Starting SEQUENTIAL test with {len(questions)} questions...')
    start_time = asyncio.get_event_loop().time()
    results = []
    
    for i, question in enumerate(questions, 1):
        print(f'\n=== Question {i}: {question} ===')
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    'http://localhost:8000/api/stream',
                    json={
                        'message': question,
                        'messages': []
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    # Parse the streaming response
                    content = response.text
                    lines = content.strip().split('\n')
                    
                    # Count tool calls and extract final response
                    tool_calls = 0
                    final_response = ""
                    orchestrator_tokens = 0
                    sub_agent_events = 0
                    
                    for line in lines:
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[6:])  # Remove 'data: ' prefix
                                event_type = data.get('type', '')
                                
                                if event_type == 'tool_call_event':
                                    tool_calls += 1
                                    print(f"  🔧 Tool call: {data.get('data', {}).get('tool_name', 'unknown')}")
                                elif event_type == 'orchestrator_token':
                                    orchestrator_tokens += 1
                                elif event_type == 'sub_agent_event':
                                    sub_agent_events += 1
                                elif event_type == 'final_response':
                                    final_response = data.get('text', '')
                            except json.JSONDecodeError:
                                continue
                    
                    # Extract a summary of the response
                    response_summary = final_response[:200] + "..." if len(final_response) > 200 else final_response
                    
                    result = {
                        'question_num': i,
                        'question': question,
                        'tool_calls': tool_calls,
                        'orchestrator_tokens': orchestrator_tokens,
                        'sub_agent_events': sub_agent_events,
                        'response_length': len(final_response),
                        'response_summary': response_summary,
                        'status': 'success'
                    }
                    
                    print(f"  📊 Tool calls: {tool_calls}")
                    print(f"  📝 Orchestrator tokens: {orchestrator_tokens}")
                    print(f"  🤖 Sub-agent events: {sub_agent_events}")
                    print(f"  📄 Response length: {len(final_response)} chars")
                    print(f"  💬 Response: {response_summary}")
                    
                else:
                    result = {
                        'question_num': i,
                        'question': question,
                        'tool_calls': 0,
                        'orchestrator_tokens': 0,
                        'sub_agent_events': 0,
                        'response_length': 0,
                        'response_summary': f"Error: {response.status_code}",
                        'status': 'error'
                    }
                    print(f"  ❌ Error: {response.status_code}")
                    
        except Exception as e:
            result = {
                'question_num': i,
                'question': question,
                'tool_calls': 0,
                'orchestrator_tokens': 0,
                'sub_agent_events': 0,
                'response_length': 0,
                'response_summary': f"Exception: {str(e)}",
                'status': 'exception'
            }
            print(f"  💥 Exception: {str(e)}")
        
        results.append(result)
        print(f"  ✅ Completed question {i}")
    
    end_time = asyncio.get_event_loop().time()
    total_time = end_time - start_time
    
    print(f'\n⏱️  Total execution time: {total_time:.2f} seconds')
    print('\n=== FINAL SUMMARY ===')
    total_tool_calls = sum(r['tool_calls'] for r in results)
    total_tokens = sum(r['orchestrator_tokens'] for r in results)
    total_sub_events = sum(r['sub_agent_events'] for r in results)
    successful_questions = len([r for r in results if r['status'] == 'success'])
    
    print(f"Total questions: {len(questions)}")
    print(f"Successful responses: {successful_questions}")
    print(f"Total tool calls: {total_tool_calls}")
    print(f"Total orchestrator tokens: {total_tokens}")
    print(f"Total sub-agent events: {total_sub_events}")
    print(f"Average tool calls per question: {total_tool_calls/len(questions):.1f}")
    print(f"Average time per question: {total_time/len(questions):.2f} seconds")
    print(f"Questions per second: {len(questions)/total_time:.2f}")
    
    print('\n=== DETAILED RESULTS ===')
    for result in results:
        print(f"Q{result['question_num']}: {result['question']}")
        print(f"    Status: {result['status']}")
        print(f"    Tool calls: {result['tool_calls']}")
        print(f"    Response: {result['response_summary']}")
        print()

if __name__ == "__main__":
    asyncio.run(test_weather_questions())
