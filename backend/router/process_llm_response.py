import asyncio
from typing import List, Callable, Union
import json




# ------------------------------------------------------------------------
# Tool Calling Logic
# ------------------------------------------------------------------------
from typing import TypedDict, List, Any

class ToolCallResponse(TypedDict):
    success: bool
    new_conversation_entries: List[Any]



async def execute_single_tool_call(tool_call: dict, execute_tool: Callable) -> ToolCallResponse:
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
    local_conversation = []


    if not tool_name or not tool_args_str:

        return ToolCallResponse(
        success=False,
        new_conversation_entries=[]
    )  # Skip invalid tool calls

    try:
        # Parse arguments
        tool_args = json.loads(tool_args_str)

        # Execute tool
        # Add to conversation
        local_conversation.append({
            "role": "assistant",
            "content": "",

            "tool_calls": [tool_call]
        })

        empty_tool_call_text = ""
        tool_call_result={
            "role": "tool",
            "tool_call_id": tool_call["id"],
            "content": empty_tool_call_text
        }
        # Execute tool
        result = await execute_tool(tool_name, tool_args)
        if "agent" in tool_name:
            print(f"Result of tool call: {result} agent tool call tool name: {tool_name}")


        tool_call_result = format_tool_result_for_llm(
            tool_call["id"],
            result
        )
        local_conversation.append(
            tool_call_result
        )
        return ToolCallResponse(
            success=True,
            new_conversation_entries=local_conversation
        )

    except json.JSONDecodeError as e:
        error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
        local_conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                error_result
            )
        )
        return ToolCallResponse(
            success=False,
            new_conversation_entries=local_conversation
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        error_result = {"error": str(e)}
        local_conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                error_result
            )
        )
        return ToolCallResponse(
            success=False,
            new_conversation_entries=local_conversation
        )



def format_tool_result_for_llm( tool_call_id: str, result: dict) -> dict:
    """
    Format tool execution result for the LLM

    Handles both MCP format and simple format
    """
    # Extract content from result
    if isinstance(result, dict):
        content = ""
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
        tuple: (content_chunk, status, citations)
        - content_chunk: str or None (content to stream to client)
        - status: str ("continue", "stop", or None for continue streaming)
        - citations: current list of citations
    """
    current_tool_calls = []
    saw_tool_call = False

    # Stream one LLM response
    async for delta in llm_stream_once(conversation):
        if "choices" not in delta or not delta["choices"]:
            print(f"No choices in delta: {delta}")
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
                        print(f"Name: {func['name']}")
                        current_tool_calls[tc_index]["function"]["name"] += func["name"]
                    if "arguments" in func:
                        print(f"Arguments: {func['arguments']}")
                        current_tool_calls[tc_index]["function"]["arguments"] += func["arguments"]

        # Stream content to client and print reasoning as it happens
        # HARMONY FORMAT FIX: GPT-OSS streams to "reasoning_content" after tool calls
        # We need to capture both "content" and "reasoning_content" channels
        elif "content" in delta_obj and delta_obj["content"]:
            print(f"Content: {delta_obj['content']}")
            yield (delta_obj["content"], None)  # Content with no status change
        elif "reasoning_content" in delta_obj and delta_obj["reasoning_content"]:
            # For Harmony format: treat reasoning_content as final content after tool execution
            print ("Reasoning content: ", delta_obj["reasoning_content"])
#
        ## Check finish reason
        finish_reason = choice.get("finish_reason")
        if finish_reason:
            if finish_reason == "tool_calls" and current_tool_calls:
                # Execute tool calls concurrently

                # Create tasks for concurrent execution
                tasks = []
                for tool_call in current_tool_calls:
                    task = execute_single_tool_call(tool_call, execute_tool)
                    tasks.append(task)

                # Execute all tool calls concurrently
                results: List[Union[ToolCallResponse, BaseException]] = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, BaseException):
                        print("Stop on error")
                        yield (None, "stop")  # Stop on error
                        return
                    elif isinstance(result, dict) and "success" in result:
                        conversation.extend(result["new_conversation_entries"])

                        await asyncio.sleep(0.01)
                        print("Tool calls executed, continue loop")
                        yield (None, "continue")  # Continue with updated citations
                        return
                    else:  # Tool calls executed, continue loop
                        print("Tool calls executed, continue loop", result)
                        yield (None, "continue")
                        return

            elif finish_reason == "stop":
                print("Normal completion, we're done")
                # Normal completion, we're done
                yield (None, "stop")
                return

    # If no tools were called, we're done
    if not saw_tool_call:
        yield (None, "continue")
        return

    # This shouldn't happen, but just in case
    print("This shouldn't happen, but just in case")
    yield (None, "stop")
