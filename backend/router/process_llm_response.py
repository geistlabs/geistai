import asyncio
from typing import Dict, List, Callable, Union
import json
from constants import MAX_FAILED_COMPLETIONS



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
        "allowed": ["query", "count", "offset", "freshness", "spellcheck", "safesearch", "summary"],
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
    cleaned_args = {k: v for k, v in args.items() if k in allowed_params}

    # Always include summary: true for brave_web_search
    # Set default count to 5 for better search results quality
    if tool_name == "brave_web_search":
        cleaned_args["summary"] = True
        # Override count if not provided or if it's too low
        if "count" not in cleaned_args or cleaned_args["count"] < 5:
            cleaned_args["count"] = 5

    return cleaned_args

class ToolCallResponse(TypedDict):
    success: bool
    new_conversation_entries: List[Any]
    tool_call_result: Dict[str, Any] | None
    negotiation_data: Dict[str, Any] | None  # For finalize_negotiation tool



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

    # Validate required fields
    if not tool_name or not tool_args_str:
        print(f"   ❌ Missing tool_name or tool_args_str")
        return ToolCallResponse(
            success=False,
            new_conversation_entries=[],
            tool_call_result=None,
            negotiation_data=None
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

        # Clean tool arguments using schema-based approach
        tool_args = clean_tool_arguments(tool_name, tool_args)

        print(f"   🚀 Executing tool: {tool_name}")

        # Execute the tool
        result = await execute_tool(tool_name, tool_args)

        # Format result for LLM
        tool_call_result = format_tool_result_for_llm(
            tool_call["id"],
            result
        )

        # Add tool result to conversation
        local_conversation.append(tool_call_result)
        local_conversation.append({
            "role": "user",
            "content": "Based on the tool call answer my previous question.",
        })

        print(f"   ✅ Tool call succeeded: {tool_name}")

        # Store negotiation data if this is a finalize_negotiation tool
        # This will be picked up later to emit a negotiation channel event
        negotiation_data_to_emit = None
        if tool_name == "finalize_negotiation" and isinstance(result, dict) and "negotiation_data" in result:
            negotiation_data_to_emit = result["negotiation_data"]
            print(f"   💰 [Negotiation] Tool returned negotiation data: {negotiation_data_to_emit}")

        return ToolCallResponse(
            success=True,
            new_conversation_entries=local_conversation,
            tool_call_result=tool_call_result,
            negotiation_data=negotiation_data_to_emit
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
        return ToolCallResponse(
            success=False,
            new_conversation_entries=local_conversation,
            tool_call_result=None,
            negotiation_data=None
        )

    except Exception as e:
        print(f"   ❌ Execution error in {tool_name}: {str(e)}")
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
            tool_call_result=None,
            negotiation_data=None
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



def count_total_tool_calls(conversation):
    """Count total tool calls made in conversation so far"""
    total = 0
    for msg in conversation:
        if msg.get("role") == "assistant" and "tool_calls" in msg:
            total += len(msg["tool_calls"])
    return total

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

    # Accumulate content for logging
    accumulated_content = ""
    accumulated_reasoning = ""
    accumulated_tool_calls = []

    print(f"🔍 [agent: {agent_name}] === Starting process_llm_response_with_tools ===")
    print(f"🔍 [agent: {agent_name}] Conversation history has {len(conversation)} messages")

    # Stream one LLM response
    delta_count = 0
    content_deltas_count = 0  # Track actual content (not just reasoning markers)
    reasoning_deltas_count = 0  # Track reasoning_content deltas
    max_deltas_without_content = 500  # Safety limit for final synthesis (plenty of room for medium reasoning)
    failed_tool_calls = 0
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

                # Log tool call accumulation


        # Stream content to client and print reasoning as it happens
        # HARMONY FORMAT FIX: GPT-OSS streams to "reasoning_content" after tool calls
        # We need to capture both "content" and "reasoning_content" channels
        elif "content" in delta_obj and delta_obj["content"]:
            content_deltas_count += 1
            accumulated_content += delta_obj["content"]
            # Yield with explicit channel identification for frontend as a tuple
            yield ({
                "channel": "content",
                "data": delta_obj["content"]
            }, None)
        elif "reasoning_content" in delta_obj and delta_obj["reasoning_content"]:
            reasoning_deltas_count += 1
            accumulated_reasoning += delta_obj["reasoning_content"]

            # Yield with explicit channel identification for frontend as a tuple
            yield ({
                "channel": "reasoning",
                "data": delta_obj["reasoning_content"]
            }, None)

        # Safety: Force stop if final synthesis is stuck in reasoning loop
        if "_final" in agent_name and delta_count > max_deltas_without_content and content_deltas_count == 0:
            print(f"🔍 [agent: {agent_name}] ⚠️  SAFETY STOP: Too many deltas without content, forcing completion")
            yield (None, "stop")
            return

        ## Check finish reason
        finish_reason = choice.get("finish_reason")
        if finish_reason:
            total_tool_calls = count_total_tool_calls(conversation)
            print(f"🔍 [agent: {agent_name}] 🎯 FINISH_REASON: '{finish_reason}' | current_turn: {len(current_tool_calls)} | total_so_far: {total_tool_calls}")

            if finish_reason == "tool_calls" and current_tool_calls:
                print(f"🔍 [agent: {agent_name}] ✅ EXECUTING {len(current_tool_calls)} TOOL(S)")

                # Lo    g accumulated content and reasoning before tool execution
                if accumulated_content:
                    print(f"🔍 [agent: {agent_name}] 📄 ACCUMULATED CONTENT: '{accumulated_content}'")
                if accumulated_reasoning:
                    print(f"🔍 [agent: {agent_name}] 🧠 ACCUMULATED REASONING: '{accumulated_reasoning}'")

                # Log all tool calls being executed
                for i, tool_call in enumerate(current_tool_calls):
                    print(f"🔍 [agent: {agent_name}] 🛠️  TOOL CALL {i+1}: {tool_call}")
                    accumulated_tool_calls.append(tool_call)

                # Execute tool calls concurrently

                # Create tasks for concurrent execution
                tasks = []
                for tool_call in current_tool_calls:
                    tool_name = tool_call['function']['name']
                    tool_args_str = tool_call['function']['arguments']

                    # Parse and clean args for better logging
                    try:
                        tool_args_dict = json.loads(tool_args_str) if isinstance(tool_args_str, str) else tool_args_str
                        cleaned_args = clean_tool_arguments(tool_name, tool_args_dict)
                        print(f"🔍 [agent: {agent_name}]   → Tool: {tool_name}")
                    except:
                        print(f"🔍 [agent: {agent_name}]   → Tool: {tool_name}")

                    task = execute_single_tool_call(tool_call, execute_tool)
                    tasks.append(task)

                # Execute all tool calls concurrently
                results: List[Union[ToolCallResponse, BaseException]] = await asyncio.gather(*tasks, return_exceptions=True)

                # Process all results
                has_error = False
                negotiation_data_from_tools = None
                # handle tool call result and then continue
                for i, result in enumerate(results):
                    if isinstance(result, BaseException):
                        print(f"🔍 [agent: {agent_name}] ❌ Tool error: {result}")
                        has_error = True
                        break
                    elif isinstance(result, dict) and "success" in result:
                        conversation.extend(result["new_conversation_entries"])
                        # Check if this tool returned negotiation data
                        if result.get("negotiation_data"):
                            negotiation_data_from_tools = result["negotiation_data"]
                            print(f"🔍 [agent: {agent_name}] 💰 Negotiation data found in tool result")

                if has_error:
                    yield (None, "stop")
                    print("Returning at tool call error")

                # Emit negotiation channel event if we have negotiation data
                if negotiation_data_from_tools:
                    print(f"🔥 [Negotiation] Emitting negotiation channel from streaming loop: {negotiation_data_from_tools}")
                    yield ({
                        "channel": "negotiation",
                        "data": negotiation_data_from_tools
                    }, None)

                print(f"🔍 [agent: {agent_name}] 🔄 Returning 'continue' status to continue")
                yield (None, "continue")

            elif finish_reason == "stop":

                # Normal completion, we're done
                print(f"Just finished, based on {choice} {delta}")

                print(f"🔍 [agent: {agent_name}] ✅ NORMAL COMPLETION - finish_reason='stop'")

                # Log final accumulated content and reasoning
                if not accumulated_content and not accumulated_tool_calls:
                    if failed_tool_calls >= MAX_FAILED_COMPLETIONS or "_final" in agent_name:
                        print(f"🔍 [agent: {agent_name}] 🛑 MAX FAILED COMPLETIONS REACHED: {MAX_FAILED_COMPLETIONS}")
                        print(f"Reasoning: {accumulated_reasoning}")
                        print(f"Content: {accumulated_content}")
                        yield (None, "stop")
                    else:
                        developer_message = (
                            "Oops! Looks like you sent your tool call to the reasoning channel, try again."
                        )
                        print(f"🔍 [agent: {agent_name}] 🛑 DEV MESSAGE: {developer_message}")
                        print(f"Reasoning: {accumulated_reasoning}")
                        print(f"Content: {accumulated_content}")
                        conversation.append({"role": "system", "content": developer_message})
                        failed_tool_calls += 1

                        yield (None, "empty")
                # Only log the first 10 characters (as per instruction "cars")
                print(f"🔍 [agent: {agent_name}] 📄 FINAL CONTENT: '{accumulated_content[:10]}'")

                print(f"🔍 [agent: {agent_name}] 🧠 FINAL REASONING: '{accumulated_reasoning}'")

                print(f"🔍 [agent: {agent_name}] 🛠️  TOTAL TOOL CALLS: {len(accumulated_tool_calls)}")

                print(f"🔍 [agent: {agent_name}] 🛑 RETURNING 'stop' status to exit")
                yield (None, "stop")

            elif finish_reason == "length":
                # Token limit reached - treat as stop
                print(f"🔍 [agent: {agent_name}] ⚠️  Token limit reached, stopping")
                yield (None, "stop")



    # This shouldn't happen, but just in case
    print(f"🔍 [agent: {agent_name}] ⚠️  Stream ended without finish_reason (no tool calls were made)")

    # Log any accumulated content even if stream ended unexpectedly
    if accumulated_content:
        print(f"🔍 [agent: {agent_name}] 📄 UNEXPECTED END - CONTENT: '{accumulated_content}'")
    if accumulated_reasoning:
        print(f"🔍 [agent: {agent_name}] 🧠 UNEXPECTED END - REASONING: '{accumulated_reasoning}'")

    yield (None, "stop")
