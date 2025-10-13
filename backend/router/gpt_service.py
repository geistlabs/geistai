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
from answer_mode import answer_mode_stream
from query_router import route_query
from events import EventEmitter


# MCP imports
from simple_mcp_client import SimpleMCPClient




# Maximum number of tool calls in a single conversation turn
MAX_TOOL_CALLS = 3

# Force response after N tool iterations (industry standard pattern)
# After this many tool calls, remove tools and force LLM to generate final answer
FORCE_RESPONSE_AFTER = 1  # Trigger answer mode immediately after first tool call


class GptService(EventEmitter):
    """Main service for handling GPT requests with tool support"""

    def __init__(self, config, can_log: bool = False):
        super().__init__()
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        self.config = config
        self.can_log = can_log

        # Multi-model inference URLs
        self.qwen_url = config.INFERENCE_URL_QWEN
        self.llama_url = config.INFERENCE_URL_LLAMA

        print(f"📍 Inference URLs configured:")
        print(f"   Qwen (tools/complex): {self.qwen_url}")
        print(f"   Llama (creative/simple): {self.llama_url}")

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
        print("Registering citation tool")
        async def citation_handler(arguments) -> Dict:

           """Simple calculator tool"""
           print("Citation handler called with arguments:", arguments)
           try:               
                print(f"Citation handler returning arguments: {arguments.get('text')}")
                return arguments
           except Exception as e:
                print(f"Error in citation handler: {e}")
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
        print(f"Connecting to mcp servers at MCP URLs: {self.config.MCP_URLS}")
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
        if tool_name not in self._tool_registry:
            return {"error": f"Tool '{tool_name}' not found"}

        # Emit tool call start event
        self.emit("tool_call_start", {
            "tool_name": tool_name,
            "arguments": arguments
        })

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
    # Tool Findings Extraction
    # ------------------------------------------------------------------------

    def _extract_tool_findings(self, conversation: List[dict]) -> str:
        """
        Extract tool results from conversation history

        Args:
            conversation: Message history with tool results

        Returns:
            Text summary of tool findings (balanced for context vs speed)
        """
        import re

        findings = []

        for msg in conversation:
            if msg.get("role") == "tool":
                content = msg.get("content", "")

                # Strip HTML tags for cleaner content
                content = re.sub(r'<[^>]+>', '', content)

                # Remove extra whitespace
                content = ' '.join(content.split())

                # Truncate to 1000 chars (increased from 200 for better context)
                # This gives Llama more information to work with
                if len(content) > 1000:
                    content = content[:1000] + "..."

                findings.append(content)

        if not findings:
            return "No tool results available."

        # Return max 5 findings (increased from 3), joined
        return "\n\n---\n\n".join(findings[:5])

    # ------------------------------------------------------------------------
    # Direct Query (No Tools)
    # ------------------------------------------------------------------------

    async def direct_query(self, inference_url: str, messages: List[dict]):
        """
        Direct query to model without tools (simple queries)

        Args:
            inference_url: Which model to use (Qwen or Llama)
            messages: Conversation history

        Yields:
            Content chunks to stream to user
        """
        print(f"📨 Direct query to {inference_url}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
                f"{inference_url}/v1/chat/completions",
                json={
                    "messages": messages,
                    "stream": True,
                    "max_tokens": 512,
                    "temperature": 0.7
                }
            ) as response:

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        if line.strip() == "data: [DONE]":
                            break

                        try:
                            data = json.loads(line[6:])

                            if "choices" in data and len(data["choices"]) > 0:
                                choice = data["choices"][0]
                                delta = choice.get("delta", {})

                                # Stream content
                                if "content" in delta and delta["content"]:
                                    yield delta["content"]

                                # Stop on finish
                                finish_reason = choice.get("finish_reason")
                                if finish_reason in ["stop", "length"]:
                                    break

                        except json.JSONDecodeError:
                            continue

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
        Stream chat request with multi-model routing and tool calling support

        Yields:
            str: Content chunks to stream to client
        """
        # Initialize tools if not already done
        if not self._tool_registry:
            await self.init_tools()

        # ROUTING: Determine which model/flow to use
        query = messages[-1]["content"] if messages else ""
        route = route_query(query)
        print(f"🎯 Query routed to: {route}")
        print(f"   Query: '{query[:80]}...'")

        # Route 1: Creative/Simple → Llama direct (no tools)
        if route == "llama":
            print(f"📝 Using Llama for creative/simple query")
            async for chunk in self.direct_query(self.llama_url, messages):
                yield chunk
            return

        # Route 2: Code/Complex → Qwen direct (no tools)
        elif route == "qwen_direct":
            print(f"🧠 Using Qwen for complex query (no tools)")
            async for chunk in self.direct_query(self.qwen_url, messages):
                yield chunk
            return

        # Route 3: Tool queries → Use MCP tools directly (bypass orchestrator)
        print(f"🔧 Using tool flow for query (route: {route})")

        # Override agent_name and permitted_tools for direct MCP usage
        if route == "qwen_tools":
            agent_name = "assistant"  # Direct assistant, not orchestrator
            # Use MCP tools directly (brave_web_search, fetch)
            permitted_tools = ["brave_web_search", "brave_summarizer", "fetch"]
            print(f"   Using MCP tools directly: {permitted_tools}")

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

            print(f"🌐 llm_stream_once: Sending request to {url}")
            try:
                print(f"🔍 agent_name: {agent_name} request data: {request_data}")
                async with httpx.AsyncClient(timeout=self.config.INFERENCE_TIMEOUT) as client:
                    async with client.stream(
                        "POST",
                        f"{url}/v1/chat/completions",
                        headers=headers,
                        json=request_data,
                        timeout=self.config.INFERENCE_TIMEOUT
                    ) as resp:
                        print(f"   ✅ Response status: {resp.status_code}")
                        line_count = 0
                        async for line in resp.aiter_lines():
                            line_count += 1
                            if line_count <= 3:
                                print(f"   📝 Line {line_count}: {line[:100]}")

                            if not line or not line.startswith("data: "):
                                continue

                            if "[DONE]" in line:
                                print(f"   🏁 Stream completed ({line_count} lines total)")
                                break

                            try:
                                payload = json.loads(line[6:])  # Remove "data: " prefix
                                yield payload
                            except json.JSONDecodeError as je:
                                print(f"   ⚠️  JSON decode error: {je}")
                                continue
            except Exception as e:
                print(f"❌ DEBUG: Exception in llm_stream_once: {e}")
                import traceback
                traceback.print_exc()

        # Main tool calling loop
        tool_call_count = 0

        while tool_call_count < MAX_TOOL_CALLS:

            # ANSWER MODE: After N tool calls, switch to answer-only mode
            # This prevents infinite loops by forcing content generation
            force_response = tool_call_count >= FORCE_RESPONSE_AFTER
            if force_response:
                print(f"🛑 Switching to ANSWER MODE after {tool_call_count} tool calls")

                # Extract tool results from conversation as findings
                findings = self._extract_tool_findings(conversation)

                # OPTIMIZATION: Use Llama for answer generation (15x faster than Qwen)
                # Llama: 2-3s for summaries vs Qwen: 30-40s
                answer_url = self.llama_url  # Use Llama instead of Qwen
                print(f"📝 Calling answer_mode with Llama (faster) - findings ({len(findings)} chars)")

                # Use answer mode (tools disabled, firewall active)
                async for chunk in answer_mode_stream(query, findings, answer_url):
                    yield chunk

                print(f"✅ Answer mode completed")
                return  # Done - no more loops

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
                    break  # Exit the inner loop to continue the outer loop

  