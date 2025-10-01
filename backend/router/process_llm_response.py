import asyncio
from typing import List, Callable
import json


    
# ------------------------------------------------------------------------
# Tool Calling Logic
# ------------------------------------------------------------------------
    


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
        execute_tool: callable,
        llm_stream_once: callable,
        conversation: List[dict],
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
        async for delta in llm_stream_once(conversation):
            if "choices" not in delta or not delta["choices"]:
                # Print reasoning content as it happens
                continue

            choice = delta["choices"][0]
            delta_obj = choice.get("delta", {})

            # Accumulate tool calls
            if "tool_calls" in delta_obj:
                saw_tool_call = True

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
                print(delta_obj["content"], end="", flush=True)
                yield (delta_obj["content"], None)  # Content with no status change

            # Check finish reason
            finish_reason = choice.get("finish_reason")
            if finish_reason:
                if finish_reason == "tool_calls" and current_tool_calls:
                    # Execute tool calls
                    for tool_call in current_tool_calls:
                        tool_name = tool_call["function"]["name"]
                        tool_args_str = tool_call["function"]["arguments"]

                        if not tool_name or not tool_args_str:
                            continue

                        try:
                            # Parse arguments
                            tool_args = json.loads(tool_args_str)

                            # Execute tool
                            result = await execute_tool(tool_name, tool_args)

                            # Add to conversation
                            conversation.append({
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [tool_call]
                            })
                            conversation.append(
                                format_tool_result_for_llm(
                                    tool_call["id"],
                                    tool_name,
                                    result
                                )
                            )

                        except json.JSONDecodeError as e:
                            error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
                            conversation.append(
                                format_tool_result_for_llm(
                                    tool_call["id"],
                                    tool_name,
                                    error_result
                                )
                            )
                            yield (None, "stop")  # Stop on error
                            return

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
    