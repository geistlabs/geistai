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
import asyncio
from typing import Dict, List, Any, Callable, Optional
import httpx

# MCP imports
from simple_mcp_client import SimpleMCPClient


# ============================================================================
# CONFIGURATION
# ============================================================================

# Tools that are permitted to be used by the LLM
# Add/remove tool names here to control what the LLM can access
PERMITTED_TOOLS = [
    "brave_web_search",  # MCP tool: Brave search
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
    
    def __init__(self):
        # Tool registry: name -> {description, input_schema, executor, type}
        self._tool_registry: Dict[str, dict] = {}
        
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
        print(f"✅ Registered {tool_type} tool: {name}")
    
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
        
        pass  # Add your custom tools above this line
    
    async def _register_mcp_tools(self, config):
        """Register tools from MCP gateway"""
        if not config.MCP_HOST:
            print("⚠️  MCP_HOST not configured, skipping MCP tools")
            return
        
        try:
            print(f"Connecting to MCP gateway at {config.MCP_HOST}")
            
            # Initialize MCP client
            self._mcp_client = SimpleMCPClient(config.MCP_HOST)
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
    
    async def init_tools(self, config):
        """
        Initialize all tools (MCP and custom)
        Call this once at startup
        """
        print("Initializing tools...")
        
        # Register custom tools first
        await self._register_custom_tools()
        
        # Then register MCP tools
        await self._register_mcp_tools(config)
        
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
            
            return result
            
        except Exception as e:
            print(f"❌ Tool execution failed: {tool_name} - {e}")
            return {"error": f"Tool execution failed: {str(e)}"}
    
    def _get_permitted_tools_for_llm(self) -> List[dict]:
        """
        Get tool definitions in OpenAI function calling format
        Only includes permitted tools
        """
        tools = []
        
        for tool_name in PERMITTED_TOOLS:
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
    
    def _format_tool_result_for_llm(self, tool_call_id: str, tool_name: str, result: dict) -> dict:
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
            "- Only use search tools when explicitly asked for current information\n"
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
    
    def get_chat_completion_params(self, config) -> tuple:
        """
        Get headers, model, and URL for chat completion
        
        Returns:
            (headers, model, url)
        """
        headers = {}
        if config.OPENAI_KEY:
            headers["Authorization"] = f"Bearer {config.OPENAI_KEY}"
        
        if config.USE_REMOTE_INFERENCE:
            url = config.REMOTE_INFERENCE_URL
            model = config.OPENAI_MODEL
        else:
            url = config.INFERENCE_URL
            model = "gpt-3.5-turbo"
        
        return headers, model, url
    
    # ------------------------------------------------------------------------
    # Non-Streaming Chat
    # ------------------------------------------------------------------------
    
    async def process_chat_request(
        self,
        messages: List[dict],
        config,
        reasoning_effort: str = "low"
    ) -> str:
        """
        Process a non-streaming chat request (no tool calling)
        
        Returns:
            AI response as string
        """
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        
        headers, model, url = self.get_chat_completion_params(config)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{url}/v1/chat/completions",
                json={
                    "messages": conversation,
                    "temperature": 0.7,
                    "max_tokens": config.MAX_TOKENS,
                    "stream": False,
                    "model": model
                },
                headers=headers,
                timeout=config.INFERENCE_TIMEOUT
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
        config,
        reasoning_effort: str = "low"
    ):
        """
        Stream chat request with tool calling support
        
        Yields:
            str: Content chunks to stream to client
        """
        # Initialize tools if not already done
        if not self._tool_registry:
            await self.init_tools(config)
        
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        headers, model, url = self.get_chat_completion_params(config)
        
        # Get permitted tools for this request
        tools_for_llm = self._get_permitted_tools_for_llm()
        
        async def llm_stream_once(msgs: List[dict]):
            """Make a single streaming LLM call"""
            request_data = {
                "messages": msgs,
                "temperature": 0.7,
                "max_tokens": config.MAX_TOKENS,
                "stream": True,
                "model": model
            }
            
            # Add tools if available
            if tools_for_llm:
                request_data["tools"] = tools_for_llm
                request_data["tool_choice"] = "auto"
            
            async with httpx.AsyncClient(timeout=config.INFERENCE_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{url}/v1/chat/completions",
                    headers=headers,
                    json=request_data,
                    timeout=config.INFERENCE_TIMEOUT
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
            current_tool_calls = []
            saw_tool_call = False
            
            # Stream one LLM response
            async for delta in llm_stream_once(conversation):
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
                
                # Stream content to client
                elif "content" in delta_obj and delta_obj["content"]:
                    yield delta_obj["content"]
                
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
                                result = await self._execute_tool(tool_name, tool_args)
                                
                                # Add to conversation
                                conversation.append({
                                    "role": "assistant",
                                    "content": None,
                                    "tool_calls": [tool_call]
                                })
                                conversation.append(
                                    self._format_tool_result_for_llm(
                                        tool_call["id"],
                                        tool_name,
                                        result
                                    )
                                )
                                
                            except json.JSONDecodeError as e:
                                error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
                                conversation.append(
                                    self._format_tool_result_for_llm(
                                        tool_call["id"],
                                        tool_name,
                                        error_result
                                    )
                                )
                                return  # Stop on error
                            
                            except Exception as e:
                                import traceback
                                traceback.print_exc()
                                error_result = {"error": str(e)}
                                conversation.append(
                                    self._format_tool_result_for_llm(
                                        tool_call["id"],
                                        tool_name,
                                        error_result
                                    )
                                )
                                return  # Stop on error
                        
                        tool_call_count += 1
                        await asyncio.sleep(0.1)
                        break  # Start new LLM call with tool results
                    
                    elif finish_reason == "stop":
                        # Normal completion, we're done
                        return
            
            # If no tools were called, we're done
            if not saw_tool_call:
                return
