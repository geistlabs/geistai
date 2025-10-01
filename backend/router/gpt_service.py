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
      # MCP tool: Brave search
    # "fetch",           # MCP tool: Web page fetching (commented out - add if needed)
    # "calculator",      # Custom tool example (see HOW TO ADD CUSTOM TOOLS below)
]

# Maximum number of tool calls in a single conversation turn
MAX_TOOL_CALLS = 3


# ============================================================================
# HOW TO ADD CUSTOM (NON-MCP) TOOLS
# ============================================================================
"""
To add a custom tool that doesn't come from MCP:

1. Define the tool execution function:
   
   async def my_custom_tool(arguments: dict) -> dict:
       '''Your tool implementation'''
       query = arguments.get("query", "")
       result = do_something(query)
       return {"content": result, "status": "success"}

2. Register it in _register_custom_tools() method:
   
   self._register_tool(
       name="my_custom_tool",
       description="What your tool does",
       input_schema={
           "type": "object",
           "properties": {
               "query": {
                   "type": "string",
                   "description": "Input parameter description"
               }
           },
           "required": ["query"]
       },
       executor=my_custom_tool,
       tool_type="custom"
   )

3. Add tool name to PERMITTED_TOOLS list above

That's it! The tool will now be available to the LLM.
"""


# ============================================================================
# TOOL REGISTRY & EXECUTION
# ============================================================================

class GptService:
    """Main service for handling GPT requests with tool support"""
    
    def __init__(self, config):
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        self.config = config
        
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
        if not self.config.MCP_HOST:
            print("⚠️  MCP_HOST not configured, skipping MCP tools")
            return
        
        try:
            print(f"Connecting to MCP gateway at {self.config.MCP_HOST}")
            
            # Initialize MCP client
            self._mcp_client = SimpleMCPClient(self.config.MCP_HOST)
            await self._mcp_client.__aenter__()
            
            # MCP handshake
            await self._mcp_client.initialize()
            await self._mcp_client.send_initialized()
            print("✅ MCP handshake completed")
            
            # Get available tools
            tools = await self._mcp_client.list_and_register_tools()
            print(f"✅ Found {len(tools)} MCP tools")
            
            # Register each MCP tool
            for tool in tools:
                tool_name = tool['name']
                
                # Create executor that calls MCP
                async def mcp_executor(args: dict, tn=tool_name) -> dict:
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
        print("Initializing tools...")
        
        # Register custom tools first
        await self._register_custom_tools()
        
        # Then register MCP tools
        await self._register_mcp_tools()
        
        print(f"✅ Tool initialization complete. Available: {list(self._tool_registry.keys())}")
    
    async def shutdown_tools(self):
        """Cleanup resources"""
        if self._mcp_client:
            await self._mcp_client.__aexit__(None, None, None)
            self._mcp_client = None
        self._tool_registry.clear()
        print("✅ Tools shutdown complete")
    
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
            
            print(f"🔧 Executing {tool_info['type']} tool: {tool_name}")
            result = await executor(arguments)
            print(f"Tool {tool_name} executed with result: {result}")
            return result
            
        except Exception as e:
            print(f"❌ Tool execution failed: {tool_name} - {e}")
            return {"error": f"Tool execution failed: {str(e)}"}
    
    def _get_permitted_tools_for_llm(self, permitted_tools: List[str]) -> List[dict]:
        """
        Get tool definitions in OpenAI function calling format
        Only includes permitted tools
        """
        tools = []
        
        for tool in self._tool_registry:
            print(f"Tool: {tool}")
        
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
            f"REASONING: {reasoning_instructions.get(reasoning_effort, reasoning_instructions['low'])}\n\n"
            "IDENTITY:\n"
            "- If asked about your identity: 'I'm a finetuned model curated by the creators of Geist.'\n"
            "- If asked about data storage: 'All conversations stay private. I only use your messages to generate responses and never store them anywhere beyond your device.'\n\n"
            "STYLE:\n"
            "- Be concise and direct\n"
            "- For simple questions, use 1-2 sentences\n"
            "- NEVER use markdown tables (|---|---| format)\n"
            "- You have access to agents in the form of tools, use them sometimes"
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
    # Streaming Chat with Tool Calling
    # ------------------------------------------------------------------------
    
    async def stream_chat_request(
        self,
        messages: List[dict],
        reasoning_effort: str = "low",
        permitted_tools: List[str] = PERMITTED_TOOLS,
        chat_initiator: str = "user"
    ):
        """
        Stream chat request with tool calling support
        
        Yields:
            str: Content chunks to stream to client
        """
        # Initialize tools if not already done
        if not self._tool_registry:
            await self.init_tools()
        

        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        headers, model, url = self.get_chat_completion_params()
        
        # Get permitted tools for this request
        tools_for_llm = self._get_permitted_tools_for_llm(permitted_tools)
        print(f"Permitted Tools for stream initiated by {chat_initiator}: {tools_for_llm}")
        
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
            
            async with httpx.AsyncClient(timeout=self.config.INFERENCE_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{url}/v1/chat/completions",
                    headers=headers,
                    json=request_data,
                    timeout=self.config.INFERENCE_TIMEOUT
                ) as resp:
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
        
        # Main tool calling loop
        tool_call_count = 0
        
        while tool_call_count < MAX_TOOL_CALLS:
            # Process one LLM response and handle tool calls
            async for content_chunk, status in process_llm_response_with_tools(
                self._execute_tool,
                llm_stream_once,
                conversation
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
