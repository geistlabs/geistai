import asyncio
from typing import List, Callable
import json




# ------------------------------------------------------------------------
# Tool Calling Logic
# ------------------------------------------------------------------------



async def execute_single_tool_call(tool_call: dict, execute_tool: Callable, conversation: List[dict]) -> bool:
    """
    Execute a single tool call and add result to conversation

    Args:
        tool_call: Tool call object
        execute_tool: Function to execute the tool
        conversation: Current conversation messages

    Returns:
        bool: True if successful, False if error occurred
    """
    tool_name = tool_call["function"]["name"]
    tool_args_str = tool_call["function"]["arguments"]

    if not tool_name or not tool_args_str:
        return True  # Skip invalid tool calls

    try:
        # Parse arguments
        tool_args = json.loads(tool_args_str)

        # Execute tool
        result = await execute_tool(tool_name, tool_args)
        print(f"Tool Result:{tool_name} {result}")
        # Add to conversation
        conversation.append({
            "role": "assistant",
            "content": "",

            "tool_calls": [tool_call]
        })

        tool_call_result = format_tool_result_for_llm(
            tool_call["id"],
            tool_name,
            result
        )
        print(f"Tool Call Result:{tool_call_result}")
        conversation.append(
            tool_call_result
        )
        return True

    except json.JSONDecodeError as e:
        error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
        conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                tool_name,
                error_result
            )
        )
        return False

    except Exception as e:
        import traceback
        traceback.print_exc()
        error_result = {"error": str(e)}
        conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                tool_name,
                error_result
            )
        )
        return False



def format_tool_result_for_llm( tool_call_id: str, tool_name: str, result: dict) -> dict:
    """
    Format tool execution result for the LLM

    Handles both MCP format and simple format
    """
    # Extract content from result
    if isinstance(result, dict):
        # MCP format: {"result": {"content": [...]}}
        if "result" in result and "content" in result["result"]:
            content_parts = []
            for item in result["result"]["content"]:
                if isinstance(item, dict) and "text" in item:
                    content_parts.append(item["text"])
                else:
                    content_parts.append(str(item))
            content = "\n".join(content_parts)

        # Simple format: {"content": "...", "status": "success"}
        elif "content" in result:
            content = result["content"]

        # Error format
        elif "error" in result:
            content = f"Error: {result['error']}"

        # Unknown format
        else:
            content = json.dumps(result, ensure_ascii=False)
    else:
        content = str(result)

    # Return in OpenAI tool result format
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content
    }


async def process_llm_response_with_tools(
        execute_tool: Callable,
        llm_stream_once: Callable,
        conversation: List[dict],
        agent_name: str,
    ):
        """
        Process one LLM response and handle tool calls if needed

        Args:
            llm_stream_once: Function that streams one LLM response
            conversation: Current conversation messages

        Yields:
            tuple: (content_chunk, status)
            - content_chunk: str or None (content to stream to client)
            - status: str ("continue", "stop", or None for continue streaming)
        """
        current_tool_calls = []
        saw_tool_call = False

        # Stream one LLM response
        print(f"📞 Starting to stream LLM response for agent: {agent_name}")
        chunk_count = 0
        async for delta in llm_stream_once(conversation):
            chunk_count += 1
            if chunk_count <= 3 or chunk_count % 10 == 0:
                print(f"   📦 Chunk {chunk_count}: {list(delta.keys())}")

            if "choices" not in delta or not delta["choices"]:
                # Print reasoning content as it happens
                continue

            choice = delta["choices"][0]
            delta_obj = choice.get("delta", {})

            # Accumulate tool calls
            if "tool_calls" in delta_obj:
                saw_tool_call = True
                print(f"   🔧 Tool call chunk received (total tools: {len(current_tool_calls)})")


                for tc_delta in delta_obj["tool_calls"]:
                    tc_index = tc_delta.get("index", 0)
                    # Ensure array is large enough
                    while len(current_tool_calls) <= tc_index:
                        current_tool_calls.append({
                            "id": "",
                            "type": "function",
                            "function": {"name": "", "arguments": ""}
                        })

                    # Accumulate data
                    if "id" in tc_delta:
                        current_tool_calls[tc_index]["id"] = tc_delta["id"]
                    if "type" in tc_delta:
                        current_tool_calls[tc_index]["type"] = tc_delta["type"]
                    if "function" in tc_delta:
                        func = tc_delta["function"]
                        if "name" in func:
                            current_tool_calls[tc_index]["function"]["name"] += func["name"]
                        if "arguments" in func:
                            current_tool_calls[tc_index]["function"]["arguments"] += func["arguments"]

            # Stream content to client and print reasoning as it happens
            elif "content" in delta_obj and delta_obj["content"]:

                yield (delta_obj["content"], None)  # Content with no status change

            # Check finish reason
            finish_reason = choice.get("finish_reason")
            if finish_reason:
                print(f"🏁 Agent {agent_name} finish_reason={finish_reason}, tool_calls={len(current_tool_calls)}, saw_content={bool([c for c in [delta_obj.get('content')] if c])}")
                if finish_reason == "tool_calls" and current_tool_calls:
                    # Execute tool calls concurrently

                    # Create tasks for concurrent execution
                    tasks = []
                    for tool_call in current_tool_calls:


                        task = execute_single_tool_call(tool_call, execute_tool, conversation)
                        tasks.append(task)

                    # Execute all tool calls concurrently
                    results = await asyncio.gather(*tasks, return_exceptions=True)
                    print(f"Agent Results: {agent_name}")
                    if agent_name == "orchestrator":
                        print(f"Agent Results: {results}")

                    # Check if any tool call failed
                    for i, result in enumerate(results):
                        if isinstance(result, Exception):
                            yield (None, "stop")  # Stop on error
                            return
                        elif result is False:
                            yield (None, "stop")  # Stop on error
                            return

                    await asyncio.sleep(0.1)
                    yield (None, "continue")  # Tool calls executed, continue loop
                    return

                elif finish_reason == "stop":
                    # Normal completion, we're done
                    yield (None, "stop")
                    return

        # If no tools were called, we're done
        if not saw_tool_call:
            yield (None, "stop")
            return

        # This shouldn't happen, but just in case
        yield (None, "stop")
