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

def clean_tool_arguments(tool_name: str, args: dict) -> dict:
    """
    Clean tool arguments based on schema

    Args:
        tool_name: Name of the tool
        args: Raw arguments from LLM

    Returns:
        Cleaned arguments with only allowed parameters
    """
    schema = TOOL_PARAM_SCHEMAS.get(tool_name)
    if not schema:
        # If no schema defined, return as-is
        return args

    allowed_params = schema.get("allowed", [])
    return {k: v for k, v in args.items() if k in allowed_params}

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
    local_conversation = []

    print(f"\n🔧 [execute_single_tool_call] ============================================")
    print(f"   Tool: {tool_name}")
    print(f"   Call ID: {tool_call['id']}")
    print(f"   Raw arguments (string): {tool_args_str[:200]}")

    # Validate required fields
    if not tool_name or not tool_args_str:
        print(f"   ❌ Missing tool_name or tool_args_str")
        return ToolCallResponse(
            success=False,
            new_conversation_entries=[],
            tool_call_result=None
        )

    try:
        # Parse tool arguments from JSON string
        print(f"   📝 Parsing JSON arguments...")
        tool_args = json.loads(tool_args_str)
        print(f"   ✅ Parsed arguments: {json.dumps(tool_args, indent=2)[:300]}")

        # Add assistant's tool call to conversation
        local_conversation.append({
            "role": "assistant",
            "content": "",
            "tool_calls": [tool_call]
        })
        print(f"   📝 Added assistant message to conversation")

        # Clean tool arguments using schema-based approach
        print(f"   🧹 Cleaning tool arguments based on schema...")
        tool_args_before = dict(tool_args)
        tool_args = clean_tool_arguments(tool_name, tool_args)
        if tool_args_before != tool_args:
            print(f"   ✅ Arguments cleaned:")
            print(f"      Before: {tool_args_before}")
            print(f"      After:  {tool_args}")
        else:
            print(f"   ✅ No changes after cleaning")

        print(f"   🚀 Executing tool: {tool_name}({tool_args})")

        # Execute the tool
        result = await execute_tool(tool_name, tool_args)
        print(f"   ✅ Tool execution completed")
        print(f"   📊 Result: {json.dumps(result, indent=2)[:300]}")

        # Format result for LLM
        print(f"   📝 Formatting result for LLM...")
        tool_call_result = format_tool_result_for_llm(
            tool_call["id"],
            result
        )
        print(f"   ✅ Formatted result: {json.dumps(tool_call_result, indent=2)[:300]}")

        # Add tool result to conversation
        local_conversation.append(tool_call_result)
        print(f"   📝 Added tool result to conversation")

        print(f"   ✅ Tool call succeeded")
        print(f"🔧 [execute_single_tool_call] ============================================\n")

        return ToolCallResponse(
            success=True,
            new_conversation_entries=local_conversation,
            tool_call_result=tool_call_result
        )

    except json.JSONDecodeError as e:
        print(f"   ❌ JSON parsing error: {str(e)}")
        error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
        local_conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                error_result
            )
        )
        print(f"🔧 [execute_single_tool_call] ============================================\n")
        return ToolCallResponse(
            success=False,
            new_conversation_entries=local_conversation,
            tool_call_result=None
        )

    except Exception as e:
        print(f"   ❌ Execution error: {str(e)}")
        import traceback
        traceback.print_exc()
        error_result = {"error": str(e)}
        local_conversation.append(
            format_tool_result_for_llm(
                tool_call["id"],
                error_result
            )
        )
        print(f"🔧 [execute_single_tool_call] ============================================\n")
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

    print(f"🔍 [agent: {agent_name}] === Starting process_llm_response_with_tools ===")
    print(f"🔍 [agent: {agent_name}] Conversation history has {len(conversation)} messages")

    # Stream one LLM response
    delta_count = 0
    content_deltas_count = 0  # Track actual content (not just reasoning markers)
    max_deltas_without_content = 100  # Safety limit for final synthesis
    async for delta in llm_stream_once(conversation):
        delta_count += 1
        if delta_count <= 3 or delta_count % 10 == 0:
            print(f"🔍 [agent: {agent_name}] Delta #{delta_count}: {str(delta)[:200]}...")

        if "choices" not in delta or not delta["choices"]:
            print(f"🔍 [agent: {agent_name}] ⚠️  Delta #{delta_count} - No choices in delta, skipping")
            continue

        choice = delta["choices"][0]
        delta_obj = choice.get("delta", {})

        print(f"🔍 [agent: {agent_name}] Delta #{delta_count} - delta_obj keys: {list(delta_obj.keys())}, finish_reason: {choice.get('finish_reason', 'NONE')}")

        # Accumulate tool calls
        if "tool_calls" in delta_obj:
            saw_tool_call = True
            print(f"🔍 [agent: {agent_name}] 🛠️  TOOL CALL DETECTED in delta #{delta_count}")

            for tc_delta in delta_obj["tool_calls"]:
                tc_index = tc_delta.get("index", 0)
                print(f"🔍 [agent: {agent_name}]   Tool delta index={tc_index}: {tc_delta}")
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

            print(f"🔍 [agent: {agent_name}] Current accumulated tool_calls: {json.dumps(current_tool_calls, indent=2)[:500]}")

        # Stream content to client and print reasoning as it happens
        # HARMONY FORMAT FIX: GPT-OSS streams to "reasoning_content" after tool calls
        # We need to capture both "content" and "reasoning_content" channels
        elif "content" in delta_obj and delta_obj["content"]:
            content_preview = delta_obj["content"][:50] + "..." if len(delta_obj["content"]) > 50 else delta_obj["content"]
            print(f"🔍 [agent: {agent_name}] 📝 Content chunk: {content_preview}")
            content_deltas_count += 1
            yield (delta_obj["content"], None)  # Content with no status change
        elif "reasoning_content" in delta_obj and delta_obj["reasoning_content"]:
            # With llama.cpp --reasoning-format none, this should rarely happen
            # But if it does, stream it as content
            content_preview = delta_obj["reasoning_content"][:50] + "..." if len(delta_obj["reasoning_content"]) > 50 else delta_obj["reasoning_content"]
            print(f"🔍 [agent: {agent_name}] 📝 Content: {content_preview}")
            content_deltas_count += 1
            yield (delta_obj["reasoning_content"], None)

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
