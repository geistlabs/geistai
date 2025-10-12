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


# MCP imports
from simple_mcp_client import SimpleMCPClient


# ============================================================================
# CONFIGURATION
# ============================================================================

# Tools that are permitted to be used by the LLM
# Add/remove tool names here to control what the LLM can access
PERMITTED_TOOLS = [
   "research_agent",
   "creative_agent",
   "technical_agent",
   "summary_agent",
   "current_info_agent",
  # "brave_web_search",  # MCP tool: Web search via Brave API
  # "fetch",             # MCP tool: Web page fetching (commented out - add if needed)
    #"calculator",      # Custom tool example (see HOW TO ADD CUSTOM TOOLS below)
]

# Maximum number of tool calls in a single conversation turn
MAX_TOOL_CALLS = 10

# Force response after N tool iterations (industry standard pattern)
# After this many tool calls, remove tools and force LLM to generate final answer
FORCE_RESPONSE_AFTER = 1  # Trigger answer mode immediately after first tool call


class GptService:
    """Main service for handling GPT requests with tool support"""

    def __init__(self, config, can_log: bool = False):
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        self.config = config
        self.can_log = can_log

        # Multi-model inference URLs
        self.qwen_url = config.INFERENCE_URL_QWEN
        self.gpt_oss_url = config.INFERENCE_URL_GPT_OSS

        print(f"📍 Inference URLs configured:")
        print(f"   Qwen (tools/complex): {self.qwen_url}")
        print(f"   GPT-OSS (creative/simple): {self.gpt_oss_url}")

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
        documentation at top of file for how to add new tools.
        """
        # Example custom tool (commented out - uncomment to use):
        #
        # async def calculator(arguments: dict) -> dict:
        #     """Simple calculator tool"""
        #     try:
        #         expression = arguments.get("expression", "")
        #         result = eval(expression)  # WARNING: eval is dangerous in production!
        #         return {"content": str(result), "status": "success"}
        #     except Exception as e:
        #         return {"error": str(e)}
        #
        # self._register_tool(
        #     name="calculator",
        #     description="Perform mathematical calculations",
        #     input_schema={
        #         "type": "object",
        #         "properties": {
        #             "expression": {
        #                 "type": "string",
        #                 "description": "Mathematical expression to evaluate"
        #             }
        #         },
        #         "required": ["expression"]
        #     },
        #     executor=calculator,
        #     tool_type="custom"
        #     )

        # ========================================================================
        # AGENT TOOLS - Uncomment to add specialized agents
        # ========================================================================

        # Example: Register all predefined agents
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

        try:
            tool_info = self._tool_registry[tool_name]
            executor = tool_info["executor"]
            print(f"Executing tool: {tool_name} with arguments: {arguments}")
            result = await executor(arguments)
            return result

        except Exception as e:
            return {"error": f"Tool execution failed: {str(e)}"}




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


    # ------------------------------------------------------------------------
    # Message Preparation
    # ------------------------------------------------------------------------

    def prepare_conversation_messages(self, messages: List[dict], reasoning_effort: str = "low") -> List[dict]:
        """
        Prepare messages for the LLM with system prompt

        Args:
            messages: Raw conversation history
            reasoning_effort: "low", "medium", or "high"

        Returns:
            Messages with system prompt injected
        """
        reasoning_instructions = {
            "low": "Think briefly before responding.",
            "medium": "Think step by step before responding. Consider potential issues or alternatives.",
            "high": "Think deeply through this problem. Consider multiple approaches, potential issues, edge cases, and alternatives before providing your final response."
        }

        system_prompt = (
            "You are Geist — a privacy-focused AI companion.\n\n"
            f"REASONING:\n{reasoning_instructions.get(reasoning_effort, reasoning_instructions['low'])}\n\n"
        "IDENTITY:\n"
        "- If asked about your identity, say you were created by Geist AI and you're a privacy-focused AI companion.\n\n"
        "KNOWLEDGE LIMITS & TOOLS:\n"
        "- When not using tools, your knowledge goes up to 2023.\n"
        "- If the user asks a time-sensitive, location-based, or external-fact question that cannot be answered confidently from your 2023 knowledge, you MUST use the current-info or research agent.\n"
        "- Default rule: If you are uncertain, assume you MUST search.\n"
        "- If the user provides a URL → fetch it directly and extract the requested facts (do NOT search first; no link-dumps).\n"
        "- Never use result_filters\n"
        "- If no URL and the query requires fresh/local/external data → search first, then fetch the best source(s) before answering.\n"
        "- Never skip this step: failure to use the tools when uncertain is a violation of contract.\n"
        "- Prefer `fetch`; use summarizer only on fetched HTML or when fetch is blocked. If fetch fails, retry once, then use a different reputable source.\n\n"
        "STYLE & BEHAVIOR:\n"
        "- Do-the-thing: directly produce what the user asked for without deflecting or asking permission.\n"
        "- Be clear, concise, and direct unless creativity or elaboration is requested.\n"
        "- NEVER use markdown tables (|---|) unless the user explicitly asks for a table.\n"
        "- When you use a tool, integrate its results faithfully. If a tool returns long-form creative content, include the full text exactly as returned (no summaries, no prefaces).\n"
        "- If a tool returns links with text, never tell the user to visit the site; extract the needed info and optionally add a single Source: line (site + URL).\n"
        "- Always include runnable code when asked for a script (fenced code block, minimal deps, ready to run).\n"
        "- Ask a clarifying question only when you cannot reasonably infer the missing detail; otherwise proceed with a brief stated assumption.\n"
        "- If you lack memory of prior choices, say so briefly and immediately offer fresh, concrete recommendations.\n"
        "- Be confident and solution-oriented; avoid hedging and permission-seeking language.\n\n"
        "OUTPUT CONTRACT:\n"
        "- Lead with the answer in 1–5 sentences.\n"
        "- If you had to search or fetch, you MUST integrate that data. Never answer \"I don't know\" when tools are available.\n"
        "- If you used web sources, add exactly one line: Source: <site> (<url>)\n"
        "IMPORTANT CITATION CONTRACT:\n"
        "- When you have provided information from a web search or an agent always cite your sources like [1], [2], etc.\n"
        "- If the source is an agent carry over the citation from the agent to the final response, you can change the the source number if you want to"
)


        result_messages = []
        has_system = any(msg.get("role") == "system" for msg in messages)

        if not has_system:
            result_messages.append({"role": "system", "content": system_prompt})
            result_messages.extend(messages)
        else:
            for msg in messages:
                if msg.get("role") == "system":
                    enhanced = msg.get("content", "") + "\n\n" + system_prompt
                    result_messages.append({"role": "system", "content": enhanced})
                else:
                    result_messages.append(msg)

        return result_messages

    # ------------------------------------------------------------------------
    # LLM Configuration
    # ------------------------------------------------------------------------

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
    # Non-Streaming Chat
    # ------------------------------------------------------------------------

    async def process_chat_request(
        self,
        messages: List[dict],
        reasoning_effort: str = "low"
    ) -> str:
        """
        Process a non-streaming chat request (no tool calling)

        Returns:
            AI response as string
        """
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)

        headers, model, url = self.get_chat_completion_params()

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
            Text summary of tool findings (optimized for speed)
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

                # Truncate to 200 chars (optimized from 500)
                if len(content) > 200:
                    content = content[:200] + "..."

                findings.append(content)

        if not findings:
            return "No tool results available."

        # Return max 3 findings, joined
        return "\n".join(findings[:3])

    # ------------------------------------------------------------------------
    # Direct Query (No Tools)
    # ------------------------------------------------------------------------

    async def direct_query(self, inference_url: str, messages: List[dict]):
        """
        Direct query to model without tools (simple queries)

        Args:
            inference_url: Which model to use (Qwen or GPT-OSS)
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
        reasoning_effort: str = "low",
        agent_name: str = "orchestrator",
        permitted_tools: List[str] = PERMITTED_TOOLS,

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

        # Route 1: Creative/Simple → GPT-OSS direct (no tools)
        if route == "gpt_oss":
            print(f"📝 Using GPT-OSS for creative/simple query")
            async for chunk in self.direct_query(self.gpt_oss_url, messages):
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

        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        headers, model, url = self.get_chat_completion_params()

        # Get permitted tools for this request
        tools_for_llm = self._get_permitted_tools_for_llm(permitted_tools)
        print("Tools for LLM:", [tool["function"]["name"] for tool in tools_for_llm])


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
            print(f"🔄 Tool calling loop iteration {tool_call_count + 1}/{MAX_TOOL_CALLS} for agent: {agent_name}")

            # ANSWER MODE: After N tool calls, switch to answer-only mode
            # This prevents infinite loops by forcing content generation
            force_response = tool_call_count >= FORCE_RESPONSE_AFTER
            if force_response:
                print(f"🛑 Switching to ANSWER MODE after {tool_call_count} tool calls")

                # Extract tool results from conversation as findings
                findings = self._extract_tool_findings(conversation)

                # OPTIMIZATION: Use GPT-OSS for answer generation (15x faster than Qwen)
                # GPT-OSS: 2-3s for summaries vs Qwen: 30-40s
                answer_url = self.gpt_oss_url  # Use GPT-OSS instead of Qwen
                print(f"📝 Calling answer_mode with GPT-OSS (faster) - findings ({len(findings)} chars)")

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
                    print(f"✅ Agent {agent_name} stopped normally")
                    return
                elif status == "continue":  # Tool calls executed, continue loop
                    tool_call_count += 1
                    print(f"🔁 Agent {agent_name} continuing after tool execution (iteration {tool_call_count})")
                    break  # Exit the inner loop to continue the outer loop
