import json
import contextlib
import asyncio
import uuid
import subprocess
import os
from typing import Dict, List
import httpx

# MCP imports
from simple_mcp_client import SimpleMCPClient


class GptService:
    def __init__(self):
        self._tool_registry: Dict[str, dict] = {}
        self._mcp_client: SimpleMCPClient = None

    async def init_mcp(self, config):
        """Initialize MCP client using simple HTTP client"""
        try:
            print("Initializing MCP with simple HTTP client")
            await self._init_simple_mcp(config)
            print(f"MCP initialization complete. Available tools: {list(self._tool_registry.keys())}")
            
        except Exception as e:
            print(f"Failed to initialize MCP: {e}")
            # Don't raise - allow service to continue without MCP tools
            self._tool_registry = {}

    async def _init_simple_mcp(self, config):
        """Initialize MCP using simple HTTP client"""
        print(f"Initializing MCP using simple HTTP client to connect to MCP gateway")
        print(f"MCP_HOST: {config.MCP_HOST}")
        
        mcp_host = config.MCP_HOST
        if not mcp_host:
            print("❌ MCP_HOST environment variable not set")
            return
        
        try:
            # Create and initialize the simple MCP client
            self._mcp_client = SimpleMCPClient(mcp_host)
            await self._mcp_client.__aenter__()
            
            # Initialize the session
            result = await self._mcp_client.initialize()
            print(f"✅ MCP session initialized: {result}")
            
            # Send initialized notification
            await self._mcp_client.send_initialized()
            print("✅ MCP handshake completed")
            
            # List and register tools
            tools = await self._mcp_client.list_tools()
            print(f"✅ Found {len(tools)} tools from MCP gateway")
            
            for tool in tools:
                self._tool_registry[tool['name']] = {
                    "client": self._mcp_client,
                    "description": tool.get('description', ''),
                    "service": "mcp-gateway",
                    "input_schema": tool.get('inputSchema', {})
                }
                print(f"✅ Registered tool: {tool['name']} from MCP gateway")
                
        except Exception as e:
            print(f"❌ Failed to connect to MCP gateway at {mcp_host}: {e}")
            print(f"   Error details: {str(e)}")
            if self._mcp_client:
                await self._mcp_client.__aexit__(None, None, None)
                self._mcp_client = None

    async def shutdown_mcp(self):
        """Cleanup MCP client"""
        if self._mcp_client:
            await self._mcp_client.__aexit__(None, None, None)
            self._mcp_client = None
        self._tool_registry.clear()

    async def _call_mcp_tool(self, tool_name: str, arguments: dict):
        """Call an MCP tool"""
        print(f"Calling MCP tool: {tool_name} with arguments: {arguments}")
        if tool_name not in self._tool_registry:
            return {"error": f"Tool {tool_name} not found"}
        
        try:
            client = self._tool_registry[tool_name]["client"]
            result = await client.call_tool(tool_name, arguments)
            
            # Extract content from MCP result
            if "result" in result and "content" in result["result"]:
                content_data = []
                for content in result["result"]["content"]:
                    if isinstance(content, dict):
                        if "text" in content:
                            content_data.append(content["text"])
                        elif "data" in content:
                            content_data.append(str(content["data"]))
                        else:
                            content_data.append(str(content))
                    else:
                        content_data.append(str(content))
                
                return {
                    "tool": tool_name,
                    "content": "\n".join(content_data),
                    "status": "success"
                }
            else:
                return {
                    "tool": tool_name,
                    "content": str(result),
                    "status": "success"
                }
                
        except Exception as e:
            print(f"Error calling MCP tool {tool_name}: {e}")
            return {"error": f"Tool call failed: {str(e)}"}
    
    def prepare_conversation_messages(self, messages, reasoning_effort="low"):
        # This function seems correct, no changes needed here.
        reasoning_instructions = {
            "low": "Think briefly before responding.",
            "medium": "Think step by step before responding. Consider potential issues or alternatives.",
            "high": "Think deeply through this problem. Consider multiple approaches, potential issues, edge cases, and alternatives before providing your final response."
        }
        reasoning_instruction = reasoning_instructions.get(reasoning_effort, reasoning_instructions["low"])
        mobile_prompt = (
            "You are Geist — a privacy-focused AI companion."
            "\n\n"
            "REASONING INSTRUCTIONS:\n"
            f"{reasoning_instruction}\n\n"
            "IDENTITY & DATA HANDLING RULES:\n"
            "If asked about your identity, model, or capabilities, always respond: "
            "'I'm a finetuned model curated by the creators of Geist.'\n"
            "If asked about how data is stored, always respond: "
            "'All conversations stay private. I only use your messages to generate responses and never store them anywhere beyond your device.'\n\n"
            "STYLE & BEHAVIOR:\n"
            "Provide concise, direct answers.\n"
            "For simple questions, limit responses to 1–2 sentences.\n\n"
            "FORMATTING RULES (MOBILE CRITICAL):\n"
            "NEVER use markdown tables (|---|---|).\n"
            "Use search tools when you need current information or to verify facts.\n"
        )
        result_messages = []
        has_system = any(msg.get("role") == "system" for msg in messages)
        if not has_system:
            result_messages.append({"role": "system", "content": mobile_prompt})
        else:
            for msg in messages:
                if msg.get("role") == "system":
                    enhanced_content = msg.get("content", "") + "\n\n" + mobile_prompt
                    result_messages.append({"role": "system", "content": enhanced_content})
                else:
                    result_messages.append(msg)
            return result_messages
        for msg in messages:
            if msg.get("role") != "system":
                result_messages.append(msg)
        return result_messages

    async def process_chat_request(self, messages, config, reasoning_effort="low"):
        # This function seems correct, no changes needed here.
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.INFERENCE_URL}/v1/chat/completions",
                json={
                    "messages": conversation,
                    "temperature": 0.7,
                    "max_tokens": config.MAX_TOKENS,
                    "stream": False
                },
                timeout=config.INFERENCE_TIMEOUT
            )
        result = response.json()
        if "choices" not in result:
            print(f"Error: No 'choices' in response. Full response: {result}")
            raise ValueError(f"Invalid response format from inference service: {result}")
        if not result["choices"] or not result["choices"][0]:
            print(f"Error: Empty choices array. Full response: {result}")
            raise ValueError(f"Empty choices in response from inference service")
        choice = result["choices"][0]
        if "message" not in choice:
            print(f"Error: No 'message' in choice. Choice: {choice}")
            raise ValueError(f"No message in choice from inference service")
        message = choice["message"]
        content = message.get("content", "")
        if not content:
            print(f"Error: No content in message. Message: {message}")
            raise ValueError(f"No content in message from inference service")
        return content
        
    async def stream_chat_request(self, messages, config, reasoning_effort="low"):
        """Stream chat request with MCP tool calling support"""
        try:
            print(f"Starting stream_chat_request: {messages}")
            if not self._tool_registry:
                print(f"Initializing MCP")
                await self.init_mcp(config)
            print(f"Initialized MCP")
            
            conversation = self.prepare_conversation_messages(messages, reasoning_effort)
            MAX_TOOL_CALLS = 3  # Reduced to prevent infinite loops

            async def llm_stream_once(msgs):
                # Add tools to the request if available
                request_data = {
                    "messages": msgs, 
                    "temperature": 0.7, 
                    "max_tokens": config.MAX_TOKENS, 
                    "stream": True
                }
                
                # Add tool definitions if we have any
                if self._tool_registry:
                    tools = []
                    for tool_name, tool_info in self._tool_registry.items():
                        # Create dynamic tool definitions based on available tools
                        if tool_name == "search":
                            tools.append({
                                "type": "function",
                                "function": {
                                    "name": "search",
                                    "description": "Search the web using DuckDuckGo",
                                    "parameters": {
                                        "type": "object",
                                        "properties": {
                                            "query": {
                                                "type": "string",
                                                "description": "The search query"
                                            }
                                        },
                                        "required": ["query"]
                                    }
                                }
                            })
                        elif tool_name == "fetch_content":
                            tools.append({
                                "type": "function", 
                                "function": {
                                    "name": "fetch_content",
                                    "description": "Fetch and parse content from a webpage URL",
                                    "parameters": {
                                        "type": "object",
                                        "properties": {
                                            "url": {
                                                "type": "string",
                                                "description": "The webpage URL to fetch content from"
                                            }
                                        },
                                        "required": ["url"]
                                    }
                                }
                            })
                        else:
                            # Generic tool definition for other tools
                            tools.append({
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "description": tool_info.get("description", f"Tool: {tool_name}"),
                                    "parameters": {
                                        "type": "object",
                                        "properties": {},
                                        "required": []
                                    }
                                }
                            })
                    
                    if tools:
                        request_data["tools"] = tools
                        request_data["tool_choice"] = "auto"

                async with httpx.AsyncClient(timeout=config.INFERENCE_TIMEOUT) as client:
                    async with client.stream(
                        "POST",
                        f"{config.INFERENCE_URL}/v1/chat/completions",
                        json=request_data,
                    ) as resp:
                        async for line in resp.aiter_lines():
                            if not line or not line.startswith("data: "): 
                                continue
                            try:
                                payload = json.loads(line[6:])
                                yield payload
                            except json.JSONDecodeError:
                                if "[DONE]" in line:
                                    break
                                else:
                                    print(f"Could not decode line: {line}")
                                    continue

            tool_calls = 0
            while tool_calls < MAX_TOOL_CALLS:
                partial_text = []
                tool_json_chunks = []
                saw_tool = False
                current_tool_calls = []
                
                print(f"Conversation: {conversation}")
                async for delta in llm_stream_once(conversation):
                    if "choices" not in delta or not delta["choices"]:
                        continue
                        
                    choice = delta["choices"][0]
                    delta_obj = choice.get("delta", {})
                    
                    # Handle tool calls
                    if "tool_calls" in delta_obj:
                        saw_tool = True
                        tool_calls_delta = delta_obj["tool_calls"]
                        
                        for tc_delta in tool_calls_delta:
                            tc_index = tc_delta.get("index", 0)
                            
                            # Ensure we have enough tool call slots
                            while len(current_tool_calls) <= tc_index:
                                current_tool_calls.append({
                                    "id": "",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""}
                                })
                            
                            # Update tool call data
                            if "id" in tc_delta:
                                current_tool_calls[tc_index]["id"] = tc_delta["id"]
                            if "type" in tc_delta:
                                current_tool_calls[tc_index]["type"] = tc_delta["type"]
                            if "function" in tc_delta:
                                func_delta = tc_delta["function"]
                                if "name" in func_delta:
                                    current_tool_calls[tc_index]["function"]["name"] += func_delta["name"]
                                if "arguments" in func_delta:
                                    current_tool_calls[tc_index]["function"]["arguments"] += func_delta["arguments"]
                    
                    # Handle regular content
                    elif "content" in delta_obj and delta_obj["content"]:
                        content_chunk = delta_obj["content"]
                        partial_text.append(content_chunk)
                        # Stream only the content directly
                        yield content_chunk
                    
                    # Check for finish reason
                    if choice.get("finish_reason") == "tool_calls" and current_tool_calls:
                        # Execute tool calls
                        for tool_call in current_tool_calls:
                            if tool_call["function"]["name"] and tool_call["function"]["arguments"]:
                                try:
                                    args = json.loads(tool_call["function"]["arguments"])
                                    tool_name = tool_call["function"]["name"]
                                    
                                    print(f"Calling tool: {tool_name} with args: {args}")
                                    result = await self._call_mcp_tool(tool_name, args)
                                    
                                    # Add tool result to conversation
                                    conversation.append({
                                        "role": "assistant",
                                        "content": None,
                                        "tool_calls": [tool_call]
                                    })
                                    conversation.append(self._tool_result_message(tool_name, result))
                                    
                                    # Don't stream tool calling details to user - just continue processing
                                    
                                except Exception as e:
                                    print(f"Error executing tool {tool_call['function']['name']}: {e}")
                                    error_result = {"error": str(e)}
                                    conversation.append(self._tool_result_message(tool_call["function"]["name"], error_result))
                                    # If tool call fails, break to prevent infinite loops
                                    break
                        
                        tool_calls += 1
                        # Small delay to make response feel more natural
                        await asyncio.sleep(0.1)
                        break  # Break inner loop to start new LLM call
                    
                    elif choice.get("finish_reason") == "stop":
                        # Regular completion, no more tool calls
                        print("Regular completion, no more tool calls")
                        #yield "data: [DONE]\n\n"
                        return
                
                if not saw_tool:
                    print("No tool calls, we're done")
                    # No tool calls, we're done
                    #yield "data: [DONE]\n\n" 
                    return

        except Exception as e:
            print(f"Error in stream_chat_request: {e}")
            raise e

    def _preview(self, result):
        # This function seems correct, no changes needed here.
        if isinstance(result, dict):
            if "error" in result:
                return f"Error: {result['error']}"
            result_str = str(result)
            if len(result_str) > 200:
                return result_str[:200] + "..."
            return result_str
        return str(result)[:200] + ("..." if len(str(result)) > 200 else "")

    def _clean_content(self, content):
        """Clean up content to remove markdown tables and other unwanted formatting"""
        if not content:
            return content
        
        # Remove markdown table formatting
        if "|" in content:
            # Replace pipe characters with simple separators
            content = content.replace("|", " - ")
        
        # Remove markdown table separators
        if "---" in content:
            content = content.replace("---", "")
        
        # Clean up multiple spaces
        content = " ".join(content.split())
        
        return content

    def _tool_result_message(self, tool_name, result):
        # This function seems correct, no changes needed here.
        return {
            "role": "user",
            "content": f"Tool '{tool_name}' result: {json.dumps(result, ensure_ascii=False)}"
        }
