import asyncio
from typing import Dict, List, Callable, Union
import json




# ------------------------------------------------------------------------
# Tool Calling Logic
# ------------------------------------------------------------------------
from typing import TypedDict, List, Any

# Tool parameter schemas - defines allowed parameters for each tool
# Based on official Brave Search MCP documentation:
# https://github.com/brave/brave-search-mcp-server
TOOL_PARAM_SCHEMAS = {
    "brave_web_search": {
        # Official parameters from Brave API docs
        "allowed": ["query", "count", "offset", "freshness", "spellcheck", "safesearch"],
        "required": ["query"]
    },
    # brave_summarizer removed - had 0% success rate in testing
    # "brave_summarizer": {
    #     # Summarizer requires a key from web search results
    #     "allowed": ["key", "entity_info", "inline_references"],
    #     "required": ["key"]
    # },
    "fetch": {
        # Fetch tool for retrieving web page content
        "allowed": ["url", "max_length", "start_index", "raw"],
        "required": ["url"]
    }
}


class ToolCallResponse(TypedDict):
    success: bool
    new_conversation_entries: List[Any]
    tool_call_result: Dict[str, Any] | None



async def execute_single_tool_call(tool_call: dict, execute_tool: Callable) -> ToolCallResponse:
    """
    Execute a single tool call and format the result for the LLM conversation.

    Args:
        tool_call: Tool call object containing id, function name, and arguments
        execute_tool: Async function to execute the tool (takes tool_name and tool_args)

    Returns:
        ToolCallResponse: Dictionary containing:
            - success: bool indicating if execution succeeded
            - new_conversation_entries: List of conversation messages to append
            - tool_call_result: The formatted tool result or None on failure
    """
    tool_name = tool_call["function"]["name"]
    tool_args_str = tool_call["function"]["arguments"]
    print("Calling tool: ", tool_name, "with arguments: ", tool_args_str)
    local_conversation = []

    # Validate required fields
    if not tool_name or not tool_args_str:
        return ToolCallResponse(
            success=False,
            new_conversation_entries=[],
            tool_call_result=None
        )

    try:
        # Parse tool arguments from JSON string
        tool_args = json.loads(tool_args_str)
       
        # Add assistant's tool call to conversation
        local_conversation.append({
            "role": "assistant",
            "content": "",
            "tool_calls": [tool_call]
        })
  


        # Execute the tool
        result = await execute_tool(tool_name, tool_args)
        print("Tool result for ", tool_name, " is: ", json.dumps(result, indent=2))
        tool_call_result = format_tool_result_for_llm(
            tool_call["id"],
            result
        )

        local_conversation.append(tool_call_result)
        return ToolCallResponse(
            success=True,
            new_conversation_entries=local_conversation,
            tool_call_result=tool_call_result
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
            new_conversation_entries=local_conversation,
            tool_call_result=None
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
            new_conversation_entries=local_conversation,
            tool_call_result=None
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
    delta_count = 0
    content_deltas_count = 0  # Track actual content (not just reasoning markers)
    max_deltas_without_content = 100  # Safety limit for final synthesis
    async for delta in llm_stream_once(conversation):
        delta_count += 1

        if "choices" not in delta or not delta["choices"]:
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
        # HARMONY FORMAT FIX: GPT-OSS streams to "reasoning_content" after tool calls
        # We need to capture both "content" and "reasoning_content" channels
        elif "content" in delta_obj and delta_obj["content"]:
            content_deltas_count += 1
            yield (delta_obj["content"], None)  # Content with no status change


        # Safety: Force stop if final synthesis is stuck in reasoning loop
        if "_final" in agent_name and delta_count > max_deltas_without_content and content_deltas_count == 0:
            print(f"🔍 [agent: {agent_name}] ⚠️  SAFETY STOP: Too many deltas without content ({delta_count}), forcing completion")
            yield (None, "stop")
            return

        ## Check finish reason
        finish_reason = choice.get("finish_reason")
        if finish_reason:
            print(f"🔍 [agent: {agent_name}] 🎯 FINISH_REASON DETECTED: '{finish_reason}'")
            print(f"🔍 [agent: {agent_name}]    saw_tool_call={saw_tool_call}, tool_calls_count={len(current_tool_calls)}")

            if finish_reason == "tool_calls" and current_tool_calls:
                print(f"🔍 [agent: {agent_name}] ✅ EXECUTING TOOLS - finish_reason='tool_calls'")
                # Execute tool calls concurrently

                # Create tasks for concurrent execution
                tasks = []
                print(f"🔍 [agent: {agent_name}] Preparing to execute {len(current_tool_calls)} tool(s)")
                for tool_call in current_tool_calls:
                    tool_name = tool_call['function']['name']
                    tool_args = tool_call['function']['arguments']
                    print(f"🔍 [agent: {agent_name}]   → Tool: {tool_name}, Args: {tool_args[:100]}")
                    task = execute_single_tool_call(tool_call, execute_tool)
                    tasks.append(task)

                # Execute all tool calls concurrently
                print(f"🔍 [agent: {agent_name}] Running {len(tasks)} tool tasks concurrently...")
                results: List[Union[ToolCallResponse, BaseException]] = await asyncio.gather(*tasks, return_exceptions=True)

                # Process all results
                has_error = False
                for i, result in enumerate(results):
                    if isinstance(result, BaseException):
                        print(f"🔍 [agent: {agent_name}] ❌ Tool #{i} error: {result}")
                        has_error = True
                        break
                    elif isinstance(result, dict) and "success" in result:
                        tool_result_content = str(result['tool_call_result']['content'])[:100] if result['tool_call_result'] else "None"
                        print(f"🔍 [agent: {agent_name}] ✅ Tool #{i} result: {tool_result_content}")
                        conversation.extend(result["new_conversation_entries"])

                if has_error:
                    print(f"🔍 [agent: {agent_name}] 💥 Tool execution failed, stopping")
                    yield (None, "stop")
                    return

                # All tool calls processed, continue with next LLM turn
                await asyncio.sleep(0.01)
                print(f"🔍 [agent: {agent_name}] ✅ All tools executed successfully")
                print(f"🔍 [agent: {agent_name}] 🔄 RETURNING 'continue' status to loop again")
                yield (None, "continue")
                return

            elif finish_reason == "stop":
                # Normal completion, we're done
                print(f"🔍 [agent: {agent_name}] ✅ NORMAL COMPLETION - finish_reason='stop'")
                print(f"🔍 [agent: {agent_name}] 🛑 RETURNING 'stop' status to exit")
                yield (None, "stop")
                return



    # This shouldn't happen, but just in case
    print(f"🔍 [agent: {agent_name}] ⚠️  Stream ended without finish_reason (no tool calls were made)")
    yield (None, "stop")
