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
from typing import Dict, List,  Callable, Optional
import httpx
from process_llm_response import process_llm_response_with_tools
from response_schema import AgentResponse
from events import EventEmitter


# MCP imports
from simple_mcp_client import SimpleMCPClient




# Maximum number of tool calls in a single conversation turn
MAX_TOOL_CALLS = 1


class GptService(EventEmitter):
    """Main service for handling GPT requests with tool support"""

    def __init__(self, config, can_log: bool = False):
        super().__init__()
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        self.config = config
        self.can_log = can_log

        # MCP client (if MCP is enabled)
        self._mcp_client: Optional[SimpleMCPClient] = None


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
        async def citation_handler(arguments) -> Dict:

           """Simple calculator tool"""
           try:
                return arguments
           except Exception as e:
                mock_result = {
                    "text": arguments.get("text"),
                    "sources": [
                    ]
                }
                return mock_result




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


            # Register each MCP tool
            for tool in tools:
                tool_name = tool['name']

                # Create executor that calls MCP
                async def mcp_executor(args: dict, tn=tool_name) -> dict:
                    if self._mcp_client is None:
                        raise ValueError("MCP client is not initialized")
                    return await self._mcp_client.call_tool(tn, args)

                self._register_tool(
                    name=tool_name,
                    description=tool.get('description', f'MCP tool: {tool_name}'),
                    input_schema=tool.get('inputSchema', {}),
                    executor=mcp_executor,
                    tool_type="mcp"
                )

        except Exception as e:
            print(f"❌ Failed to initialize MCP: {e}")
            # Don't raise - allow service to continue without MCP

    async def init_tools(self):
        """
        Initialize all tools (MCP and custom)
        Call this once at startup
        """

        # Register custom tools first
        await self._register_custom_tools()

        # Then register MCP tools
        await self._register_mcp_tools()

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

        if tool_name not in self._tool_registry:
            return {"error": f"Tool '{tool_name}' not found"}


        # Emit tool call start event
        self.emit("tool_call_start", {
            "tool_name": tool_name,
            "arguments": arguments
        })

        start_time = time.time()

        try:
            tool_info = self._tool_registry[tool_name]
            executor = tool_info["executor"]
            result = await executor(arguments)


            # Emit tool call complete event
            self.emit("tool_call_complete", {
                "tool_name": tool_name,
                "arguments": arguments,
                "result": result
            })

            return result

        except Exception as e:

            error_result = {"error": f"Tool execution failed: {str(e)}"}

            # Emit tool call error event
            self.emit("tool_call_error", {
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
                    "temperature": 0.7,
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


        async def llm_stream_once(msgs: List[dict]):
            """Make a single streaming LLM call"""
            request_data = {
                "messages": msgs,
                "temperature": 0.7,
                "max_tokens": self.config.MAX_TOKENS,
                "stream": True,
                "model": model
            }

            # Add tools if available
            if tools_for_llm:
                request_data["tools"] = tools_for_llm
                request_data["tool_choice"] = "auto"
                if self.can_log:
                    tool_names = [tool.get("function", {}).get("name", "unknown") for tool in tools_for_llm]
                    print(f"🛠️  Tools available for LLM: {tool_names}")

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
                            print(f"❌ HTTP {resp.status_code} Error from LLM: {error_text}")

                            # Parse error details if JSON
                            try:
                                error_json = json.loads(error_text)
                                error_msg = error_json.get("message", error_text)
                                if "context" in error_msg.lower():
                                    print(f"⚠️  Context limit exceeded - {len(msgs)} messages may be too many")
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
                    return
                elif status == "continue":  # Tool calls executed, continue loop
                    tool_call_count += 1
                    print(f"🔧 Tool call #{tool_call_count} completed")
                    break  # Exit the inner loop to continue the outer loop

        # If we hit MAX_TOOL_CALLS, make one final LLM call to synthesize a response
        if tool_call_count >= MAX_TOOL_CALLS:
            print(f"⚠️  MAX_TOOL_CALLS ({MAX_TOOL_CALLS}) reached. Making final synthesis call with {tool_call_count} total calls.")
            async for content_chunk, status in process_llm_response_with_tools(
                self._execute_tool,
                llm_stream_once,
                conversation,
                agent_name
            ):
                # Stream content to client if available
                if content_chunk:
                    yield content_chunk
                # Check status - should be "stop" since we won't execute more tools
                if status == "stop":
                    print(f"✅ Chat request completed with {tool_call_count} tool calls")
                    return
