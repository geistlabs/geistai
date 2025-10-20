"""
GPT Service - Handles AI chat requests with tool calling support

This service manages:
1. Chat completions (streaming and non-streaming)
2. Tool registry (MCP and custom tools)
3. Tool execution
4. Conversation message preparation

ARCHITECTURE:
- Tools can be MCP-based (from MCP gateway) or custom (defined in this file)
- Each tool has metadata (name, description, input schema, executor)
- Tool execution is abstracted - the LLM doesn't know which type it's calling
"""

import json
from datetime import datetime
from typing import Dict, List,  Callable, Optional
import httpx
from response_schema import AgentResponse
from process_llm_response import execute_single_tool_call, process_llm_response_with_tools
from events import EventEmitter
from extract_relevant_from_webpage import extract_relevant_text


# MCP imports
from simple_mcp_client import SimpleMCPClient




# Maximum number of tool calls in a single conversation turn
MAX_TOOL_CALLS = 3  # Increased to allow more tool calls before synthesis (with 8K context we have room)


class GptService:
    """Main service for handling GPT requests with tool support"""

    def __init__(self, config, event_emitter: EventEmitter, can_log: bool = False):
        # Store the event emitter
        self.event_emitter = event_emitter
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        self.config = config
        self.can_log = can_log

        # MCP client (if MCP is enabled)
        self._mcp_client: Optional[SimpleMCPClient] = None
        
        # Tool call tracking
        self._tool_call_count = 0
        self._tool_call_history: List[dict] = []


    # ------------------------------------------------------------------------
    # Tool Call Tracking
    # ------------------------------------------------------------------------
    
    def get_tool_call_count(self) -> int:
        """Get the total number of tool calls made in this session"""
        return self._tool_call_count
    
    def get_tool_call_history(self) -> List[dict]:
        """Get the history of all tool calls made in this session"""
        return self._tool_call_history.copy()
    
    def reset_tool_call_tracking(self):
        """Reset tool call tracking counters"""
        self._tool_call_count = 0
        self._tool_call_history.clear()
    
    def _track_tool_call(self, tool_name: str, arguments: dict, result: dict, execution_time: float = 0.0):
        """Track a tool call for monitoring and debugging"""
        self._tool_call_count += 1
        tool_call_record = {
            "call_number": self._tool_call_count,
            "tool_name": tool_name,
            "arguments": arguments,
            "result": result,
            "execution_time": execution_time,
            "timestamp": datetime.now().isoformat()
        }
        self._tool_call_history.append(tool_call_record)
        
        if self.can_log:
            print(f"🔧 Tool call #{self._tool_call_count}: {tool_name} (took {execution_time:.2f}s)")
    
    def get_tool_call_statistics(self) -> dict:
        """Get statistics about tool calls made in this session"""
        if not self._tool_call_history:
            return {
                "total_calls": 0,
                "average_execution_time": 0.0,
                "tool_usage": {},
                "success_rate": 0.0
            }
        
        total_calls = len(self._tool_call_history)
        total_execution_time = sum(call["execution_time"] for call in self._tool_call_history)
        average_execution_time = total_execution_time / total_calls
        
        # Count tool usage
        tool_usage = {}
        successful_calls = 0
        
        for call in self._tool_call_history:
            tool_name = call["tool_name"]
            tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1
            
            # Check if call was successful (no error in result)
            if "error" not in call["result"]:
                successful_calls += 1
        
        success_rate = (successful_calls / total_calls) * 100 if total_calls > 0 else 0
        
        return {
            "total_calls": total_calls,
            "average_execution_time": average_execution_time,
            "tool_usage": tool_usage,
            "success_rate": success_rate,
            "total_execution_time": total_execution_time
        }

    # ------------------------------------------------------------------------
    # Tool Registration & Management
    # ------------------------------------------------------------------------



    def _register_tool(
        self,
        name: str,
        description: str,
        input_schema: dict,
        executor: Callable,
        tool_type: str = "custom"
    ):
        """
        Register a tool in the registry

        Args:
            name: Unique tool identifier
            description: What the tool does (shown to LLM)
            input_schema: JSON schema for tool parameters
            executor: Async function that executes the tool
            tool_type: "mcp" or "custom"
        """
        self._tool_registry[name] = {
            "description": description,
            "input_schema": input_schema,
            "executor": executor,
            "type": tool_type
        }

    async def _register_custom_tools(self):
        """
        Register custom (non-MCP) tools here

        This is where you add your own tools. See examples below and
        """

        async def mcp_fetch_tool(args: dict) -> Dict:
            """
            Fetch content from URLs using available MCP fetch tools.
            Expects args to be a dict with one key: 'url'.
            """
            from urllib.parse import urlparse

            url = args.get("url")
            if not url:
                return {"error": "URL is required"}

            try:
                # Validate URL
                parsed_url = urlparse(str(url))
                if not parsed_url.scheme or not parsed_url.netloc:
                    return {"error": "Invalid URL format"}

                # Find available MCP fetch tools
                fetch_tools = [
                    tool_name
                    for tool_name, tool_info in self._tool_registry.items()
                    if tool_info.get("type") == "mcp" and "fetch" in tool_name.lower()
                ]

                if not fetch_tools:
                    return {"error": "No MCP fetch tools available"}

                # Use the first available fetch tool
                fetch_tool_name = fetch_tools[0]
             
                # Prepare arguments for the MCP fetch tool
                fetch_args = {"url": url}

                # Try to add recursive flag if the tool supports it
                fetch_args["max_length"] = 10000
                fetch_args["html"] = True,
                
                fetch_args["include_links"] = True
                fetch_args["include_tables"] = True
                fetch_args["include_code"] = True
                fetch_args["recursive"] = True

                # Execute the MCP fetch tool
                result = await self._execute_tool(fetch_tool_name, fetch_args)
                if "error" in result:
                    return {"error": f"MCP fetch failed: {result['error']}"}
                # INSERT_YOUR_CODE
                # Use tiktoken if available for accurate token counting, else fallback to word count
                content = result.get("content", str(result))
                try:
                    import tiktoken
                    enc = tiktoken.get_encoding("cl100k_base")
                    token_count = len(enc.encode(content))
                except Exception:
                    # If tiktoken is not installed, do a rough word-based fallback
                    token_count = len(content.split())
             
                # Count URLs processed (simple heuristic)
                url_count = content.count("http://") + content.count("https://")
                if url_count == 0:
                    url_count = 1  # At least the original URL
                query = args.get("query")
                if not query:
                    query = "What is the main content of the page?"
                relevant_text = ""
                if token_count > 10000:
                    try: 
                        relevant_text = extract_relevant_text(content, query,max_chars=1000, max_blocks=1000)
                    except Exception as e:
                        relevant_text = "Failed to extract relevant text"

                return {
                    "urls_processed": url_count,
                    "status": "success",
                    "tool_used": fetch_tool_name,
                    "relevant_text": relevant_text
                }

            except Exception as e:
                import traceback
                print(f"Failed to fetch content: {e}")
                traceback.print_exc()
                return {"error": f"Failed to fetch content: {str(e)}"}
        # Register the MCP fetch tool
        self._register_tool(
            name="custom_mcp_fetch",
            description="Fetch relevant content from URLs using mcp tools. Uses embeddings to extract relevant text for finding textual information. Prefer this option if webpages are too big to read.",
            input_schema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch content from"
                    },
                    "query": {
                        "type": "string",
                        "description": "Example of the data you'd like to recieve to answer users question."
                    }
                },
                "required": ["url", "query"]
            },
            executor=mcp_fetch_tool,
            tool_type="custom"
        )




        from agent_registry import register_predefined_agents
        await register_predefined_agents(self, self.config)

        # Example: Register only specific agents
        #from agent_registry import register_specific_agents
        #await register_specific_agents(self, config=None, agent_names=["research_agent", "creative_agent"])

        # Example: Register a custom agent
        # from agent_registry import register_custom_agent
        # await register_custom_agent(
        #     gpt_service=self,
        #     config=None,
        #     name="math_tutor",
        #     description="A specialized agent for math tutoring and problem-solving",
        #     system_prompt=(
        #         "You are a math tutor. Your role is to:\n"
        #         "- Help students understand mathematical concepts\n"
        #         "- Solve math problems step by step\n"
        #         "- Explain the reasoning behind solutions\n"
        #         "- Provide practice problems and examples\n"
        #         "- Be patient and encouraging\n\n"
        #         "Always show your work and explain each step clearly."
        #     ),
        #     available_tools=[],  # Could add calculator tool here
        #     reasoning_effort="high"
        # )

        pass  # Add your custom tools above this line

    async def _register_mcp_tools(self):
        """Register tools from MCP gateway"""
        if not self.config.MCP_URLS:
            return
        try:

            # Initialize MCP client
            self._mcp_client = SimpleMCPClient(self.config.MCP_URLS)
            await self._mcp_client.__aenter__()

            tools = await self._mcp_client.list_tools()


            # Custom descriptions for MCP tools (emphasizing their capabilities)
            TOOL_DESCRIPTION_OVERRIDES = {
                "brave_web_search": (
                    "Search the web and get rich summaries with current information. "
                    "Returns a SUMMARY containing key facts, data, and details - not just links. "
                    "For weather queries, the summary includes temperature and conditions. "
                    "For stock prices, the summary includes current price. "
                    "For news, the summary includes headlines and key points. "
                    "READ THE SUMMARY carefully - it usually contains the answer you need."
                ),
                "fetch": (
                    "Fetch the full content of a specific web page URL. "
                    "Use this ONLY if brave_web_search summaries lack critical details. "
                    "For simple queries (weather, stocks, news), the search summary is usually sufficient."
                )
            }

            # Register each MCP tool
            for tool in tools:
                tool_name = tool['name']

                # Create executor that calls MCP
                async def mcp_executor(args: dict, tn=tool_name) -> dict:
                    if self._mcp_client is None:
                        raise ValueError("MCP client is not initialized")
                    return await self._mcp_client.call_tool(tn, args)

                # Filter input schema to only include allowed parameters
                input_schema = tool.get('inputSchema', {})

                # Use custom description if available, otherwise use MCP's description
                description = TOOL_DESCRIPTION_OVERRIDES.get(
                    tool_name,
                    tool.get('description') or f'MCP tool: {tool_name}'
                )

                self._register_tool(
                    name=tool_name,
                    description=description,
                    input_schema=input_schema,
                    executor=mcp_executor,
                    tool_type="mcp"
                )

        except Exception as e:
            print(f"❌ Failed to initialize MCP: {e}")
            # Don't raise - allow service to continue without MCP

    def _filter_tool_schema(self, tool_name: str, schema: dict) -> dict:
        """
        Filter tool schema to only include allowed parameters

        This ensures the LLM only sees parameters we support,
        preventing confusion from extra MCP parameters

        Args:
            tool_name: Name of the tool
            schema: Original schema from MCP gateway

        Returns:
            Filtered schema with only allowed parameters
        """
        from process_llm_response import TOOL_PARAM_SCHEMAS

        tool_schema = TOOL_PARAM_SCHEMAS.get(tool_name)
        if not tool_schema:
            # If no schema defined, return original schema
            return schema

        allowed_params = tool_schema.get("allowed", [])
        required_params = tool_schema.get("required", [])

        if not schema.get("properties"):
            return schema

        # Filter properties to only allowed parameters
        filtered_properties = {
            k: v for k, v in schema["properties"].items()
            if k in allowed_params
        }

        # Return filtered schema
        filtered_schema = {
            "type": "object",
            "properties": filtered_properties,
            "required": [p for p in schema.get("required", []) if p in required_params]
        }

        return filtered_schema

    async def init_tools(self):
        """
        Initialize all tools (MCP and custom)
        Call this once at startup
        """

        

    
        await self._register_mcp_tools()
        # then register custom tools (they might depend on the mcp_tools)
        await self._register_custom_tools()

    async def shutdown_tools(self):
        """Cleanup resources"""
        if self._mcp_client:
            await self._mcp_client.__aexit__(None, None, None)
            self._mcp_client = None
        self._tool_registry.clear()

    # ------------------------------------------------------------------------
    # Tool Execution
    # ------------------------------------------------------------------------

    async def _execute_tool(self, tool_name: str, arguments: dict) -> dict:
        """
        Execute a tool (works for both MCP and custom tools)

        Returns:
            dict with 'content' or 'error' key
        """
        import time
        start_time = time.time()

        if tool_name not in self._tool_registry:
            error_result = {"error": f"Tool '{tool_name}' not found"}
            self._track_tool_call(tool_name, arguments, error_result, time.time() - start_time)
            return error_result

        # Emit tool call start event
        self.event_emitter.emit("tool_call_start", {
            "tool_name": tool_name,
            "arguments": arguments
        })

        try:
            tool_info = self._tool_registry[tool_name]
            executor = tool_info["executor"]
            result = await executor(arguments)
            execution_time = time.time() - start_time

            # Track the successful tool call
            self._track_tool_call(tool_name, arguments, result, execution_time)

            # Emit tool call complete event
            self.event_emitter.emit("tool_call_complete", {
                "tool_name": tool_name,
                "arguments": arguments,
                "result": result
            })

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            error_result = {"error": f"Tool execution failed: {str(e)}"}

            # Track the failed tool call
            self._track_tool_call(tool_name, arguments, error_result, execution_time)

            # Emit tool call error event
            self.event_emitter.emit("tool_call_error", {
                "tool_name": tool_name,
                "arguments": arguments,
                "error": str(e)
            })

            return error_result





    def _get_permitted_tools_for_llm(self, permitted_tools: List[str]) -> List[dict]:
        """
        Get tool definitions in OpenAI function calling format
        Only includes permitted tools
        """
        tools = []

        for tool_name in permitted_tools:
            if tool_name not in self._tool_registry:
                continue

            tool_info = self._tool_registry[tool_name]
            input_schema = tool_info.get("input_schema", {})

            # Only include tools with valid schemas
            if input_schema and "properties" in input_schema:
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": tool_info.get("description", f"Tool: {tool_name}"),
                        "parameters": input_schema
                    }
                })
        return tools



    def get_chat_completion_params(self) -> tuple:
        headers = {}
        if self.config.OPENAI_KEY:
            headers["Authorization"] = f"Bearer {self.config.OPENAI_KEY}"

        if self.config.USE_REMOTE_INFERENCE:
            url = self.config.REMOTE_INFERENCE_URL
            model = self.config.OPENAI_MODEL
        else:
            url = self.config.INFERENCE_URL
            model = "gpt-3.5-turbo"

        return headers, model, url

    # ------------------------------------------------------------------------
    # Message Preparation
    # ------------------------------------------------------------------------

    def prepare_conversation_messages(self, messages: List[dict], reasoning_effort: str = "low", system_prompt: str = "") -> List[dict]:
        """
        Prepare messages for the LLM with optional system prompt injection.

        Args:
            messages: Raw conversation history
            reasoning_effort: "low", "medium", or "high" (unused but kept for compatibility)
            system_prompt: Optional system prompt to inject

        Returns:
            Messages with system prompt injected if provided
        """
        if not system_prompt:
            return messages

        # Check if there's already a system message
        has_system = any(msg.get("role") == "system" for msg in messages)

        if not has_system:
            # Add system prompt at the beginning
            return [{"role": "system", "content": system_prompt}] + messages
        else:
            # Replace existing system message
            result_messages = []
            for msg in messages:
                if msg.get("role") == "system":
                    result_messages.append({"role": "system", "content": system_prompt})
                else:
                    result_messages.append(msg)
            return result_messages

    # ------------------------------------------------------------------------
    # Non-Streaming Chat
    # ------------------------------------------------------------------------

    async def process_chat_request(
        self,
        messages: List[dict],
        reasoning_effort: str = "low",
        system_prompt: str = ""
    ) -> str:
        """
        Process a non-streaming chat request (no tool calling)

        Returns:
            AI response as string
        """
        conversation = self.prepare_conversation_messages(messages, reasoning_effort, system_prompt)

        headers, model, url = self.get_chat_completion_params()
        print(f"🔍 agent_name:  conversation: {conversation}")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{url}/v1/chat/completions",
                json={
                    "messages": conversation,
                    "temperature": 1.0,
                    "top_p": 1.0,
                    "max_tokens": self.config.MAX_TOKENS,
                    "stream": False,
                    "model": model
                },
                headers=headers,
                timeout=self.config.INFERENCE_TIMEOUT
            )

        result = response.json()

        # Validate response structure
        if "choices" not in result or not result["choices"]:
            raise ValueError(f"Invalid response from inference service: {result}")

        choice = result["choices"][0]
        if "message" not in choice:
            raise ValueError(f"No message in response: {choice}")

        content = choice["message"].get("content", "")
        if not content:
            raise ValueError(f"Empty content in response")

        return content

    # ------------------------------------------------------------------------
    # Streaming Chat with Tool Calling
    # ------------------------------------------------------------------------

    async def stream_chat_request(
        self,
        messages: List[dict],
        permitted_tools: List[str],
        reasoning_effort: str = "low",
        agent_name: str = "orchestrator",
        agent_prompt: str = ""

    ):
        """
        Stream chat request with tool calling support

        Yields:
            str: Content chunks to stream to client
        """
        # Initialize tools if not already done
        if not self._tool_registry:
            await self.init_tools()

        conversation = self.prepare_conversation_messages(messages, reasoning_effort, agent_prompt)
        headers, model, url = self.get_chat_completion_params()

        # Get permitted tools for this request
        tools_for_llm = self._get_permitted_tools_for_llm(permitted_tools)


        async def llm_stream_once(msgs: List[dict], use_increased_tokens: bool = False):
            """Make a single streaming LLM call

            Args:
                msgs: Messages to send
                use_increased_tokens: If True, use increased max_tokens for tool-calling scenarios
            """
            # Priority 1 Fix: Increase max_tokens for multi-tool scenarios to prevent stream termination
            # Check if conversation has tool calls (indicates multi-tool scenario)
            max_tokens_to_use = self.config.MAX_TOKENS

            has_tool_calls = any(
                msg.get("role") == "assistant" and "tool_calls" in msg
                for msg in msgs
            )

            if has_tool_calls or use_increased_tokens:
                max_tokens_to_use = min(4000, self.config.MAX_TOKENS * 4)
                if self.can_log:
                    print(f"⚡ Using increased max_tokens: {max_tokens_to_use} (multi-tool scenario detected)")

            request_data = {
                "messages": msgs,
                "temperature": 1.0,
                "top_p": 1.0,
                "max_tokens": max_tokens_to_use,
                "stream": True,
                "model": model
            }

            # Add tools if available
            if tools_for_llm:
                request_data["tools"] = tools_for_llm
                request_data["tool_choice"] = "auto"
                if self.can_log:
                    tool_names = [tool.get("function", {}).get("name", "unknown") for tool in tools_for_llm]
                    print(f"🛠️  Tools: {', '.join(tool_names)}")


            
            
            if self.can_log:
                print(f"📤 Sending request with {len(msgs)} messages")

            try:
                async with httpx.AsyncClient(timeout=self.config.INFERENCE_TIMEOUT) as client:
                    async with client.stream(
                        "POST",
                        f"{url}/v1/chat/completions",
                        headers=headers,
                        json=request_data,
                        timeout=self.config.INFERENCE_TIMEOUT
                    ) as resp:
                        # Handle HTTP errors
                        if resp.status_code != 200:
                            error_body = await resp.aread()
                            error_text = error_body.decode(errors='replace')

                            # Parse error details if JSON
                            try:
                                error_json = json.loads(error_text)
                                error_msg = error_json.get("message", error_text)
                                if "context" in error_msg.lower():
                                    print(f"⚠️  Context limit exceeded - {len(msgs)} messages may be too many")
                                    print(msgs )
                                
                            except json.JSONDecodeError:
                                pass

                            raise httpx.HTTPStatusError(
                                f"LLM request failed with status {resp.status_code}",
                                request=resp.request,
                                response=resp
                            )

                        # Stream response
                        async for line in resp.aiter_lines():
                            if not line or not line.startswith("data: "):
                                continue

                            if "[DONE]" in line:
                                break

                            try:
                                payload = json.loads(line[6:])  # Remove "data: " prefix
                                yield payload
                            except json.JSONDecodeError:
                                continue

            except httpx.HTTPStatusError:
                raise  # Re-raise HTTP errors
            except Exception as e:
                print(f"❌ Exception in LLM streaming: {e}")
                if self.can_log:
                    import traceback
                    traceback.print_exc()
                raise

        # Main tool calling loop
        tool_call_count = 0
        print(f"🚀 Starting chat request with MAX_TOOL_CALLS={MAX_TOOL_CALLS}")
        
        # Reset tool call tracking for this conversation
        self.reset_tool_call_tracking()

        exited_via_stop = False

        while tool_call_count < MAX_TOOL_CALLS:

            # Process one LLM response and handle tool calls
            async for content_chunk, status in process_llm_response_with_tools(
                self._execute_tool,
                llm_stream_once,
                conversation,
                agent_name
            ):
                # Stream content to client if available
                if content_chunk:
                    yield content_chunk
                # Check status
                if status == "stop":  # Normal completion or error
                    exited_via_stop = True
                    break  # Exit inner loop to trigger final synthesis
                elif status == "continue":  # Tool calls executed, continue loop
                    tool_call_count += 1
                    print(f"🔧 Tool call #{tool_call_count} completed")
                    break  # Exit the inner loop to continue the outer loop

            # If we got a stop status, exit the tool-calling loop
            if exited_via_stop:
                break

        # If we made tool calls and need to synthesize, do final synthesis
        # ONLY synthesize if MAX_TOOL_CALLS was reached (tool_call_count >= MAX_TOOL_CALLS)
        if tool_call_count >= MAX_TOOL_CALLS:
            print(f"⚠️  MAX_TOOL_CALLS ({MAX_TOOL_CALLS}) reached. Making final synthesis call.")

            # For final synthesis, use the full conversation but with updated system prompt
            final_conversation = []
            for msg in conversation:
                if msg.get("role") == "system":
                    # Replace system prompt for final synthesis
                    final_conversation.append({
                        "role": "system",
                        "content": """You are Geist AI. The user asked a question and you've gathered information using tools.

Now provide a clear, complete answer to their question using the search results. Include relevant facts, data, and citations. Be direct and helpful.

CRITICAL - Handle Contradictions:
- If the search results show information that contradicts the user's question (e.g., they ask for 'president' but the country has 'prime minister'), CLARIFY the distinction in your answer.
- If a title or term in the question doesn't match reality, explain what the correct term is and provide the accurate information.
- Example: If asked "who is the president of Spain", clarify that Spain has a Prime Minister (not a president) and provide both the Prime Minister's name and the King's name.

Important: This is your FINAL response to the user - make it complete, accurate, and actionable."""
                    })
                else:
                    final_conversation.append(msg)

            # Create a tool-free version of llm_stream_once for the final call
            async def llm_stream_final(msgs: List[dict]):
                """Final LLM call without tools"""
                request_data = {
                    "messages": msgs,
                    "temperature": 1.0,
                    "top_p": 1.0,
                    "max_tokens": min(4000, self.config.MAX_TOKENS * 4),
                    "stream": True,
                    "model": model,
                    "reasoning_effort": "medium"  # Better quality for final user-facing responses
                    # NO tools in this request
                }

                if self.can_log:
                    print(f"📤 Final synthesis request")

                try:
                    async with httpx.AsyncClient(timeout=self.config.INFERENCE_TIMEOUT) as client:
                        async with client.stream(
                            "POST",
                            f"{url}/v1/chat/completions",
                            headers=headers,
                            json=request_data,
                            timeout=self.config.INFERENCE_TIMEOUT
                        ) as resp:
                            if resp.status_code != 200:
                                raise httpx.HTTPStatusError(
                                    f"Final synthesis failed with status {resp.status_code}",
                                    request=resp.request,
                                    response=resp
                                )

                            async for line in resp.aiter_lines():
                                if not line or not line.startswith("data: "):
                                    continue
                                if "[DONE]" in line:
                                    break
                                try:
                                    payload = json.loads(line[6:])
                                    yield payload
                                except json.JSONDecodeError:
                                    continue

                except Exception as e:
                    if self.can_log:
                        import traceback
                        traceback.print_exc()
                    raise

            # Use process_llm_response_with_tools for proper streaming and handling
            final_synthesis_content = []
            async for content_chunk, status in process_llm_response_with_tools(
                self._execute_tool,
                llm_stream_final,
                final_conversation,
                agent_name + "_final"
            ):
                if content_chunk:
                    final_synthesis_content.append(content_chunk)
                    yield content_chunk
                if status == "stop":
                    # Print tool call statistics at the end
                    if self.can_log:
                        stats = self.get_tool_call_statistics()
                        print(f"\n📊 Tool Call Statistics:")
                        print(f"   Total calls: {stats['total_calls']}")
                        print(f"   Success rate: {stats['success_rate']:.1f}%")
                        print(f"   Average execution time: {stats['average_execution_time']:.2f}s")
                        if stats['tool_usage']:
                            print(f"   Tool usage: {stats['tool_usage']}")
                    return
                elif status == "continue":
                    # This shouldn't happen in final synthesis (no tools), but handle it
                    print(f"⚠️  Unexpected 'continue' in final synthesis, stopping")
                    return
