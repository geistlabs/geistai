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


PERMITTED_TOOLS = ["brave_web_search"]


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

    async def _call_mcp_tool(self, tool_name: str, arguments: dict, config):
        """Call an MCP tool"""
        print(f"Calling MCP tool: {tool_name} with arguments: {arguments}")
        if tool_name not in self._tool_registry:
            return {"error": f"Tool {tool_name} not found"}
        
        try:
            client = self._tool_registry[tool_name]["client"]
            
            
            # Call the tool with secrets
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
            "Only use search tools when specifically asked for current information or to verify facts.\n"
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
    def get_chat_completion_params(self,config):
        headers = {}
        if config.OPENAI_KEY:
            headers["Authorization"] = f"Bearer {config.OPENAI_KEY}"
        model  = "gpt-3.5-turbo"
        if config.USE_REMOTE_INFERENCE:
            url = config.REMOTE_INFERENCE_URL
            model = config.OPENAI_MODEL
        else:
            url = config.INFERENCE_URL
        return headers, model, url
    async def process_chat_request(self, messages, config, reasoning_effort="low"):
        # This function seems correct, no changes needed here.
        conversation = self.prepare_conversation_messages(messages, reasoning_effort)
        async with httpx.AsyncClient() as client:

            headers, model, url = self.get_chat_completion_params(config)

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
            
            if not self._tool_registry:
                print(f"Initializing MCP")
                await self.init_mcp(config)
            print(f"Initialized MCP")
            
            conversation = self.prepare_conversation_messages(messages, reasoning_effort)
            MAX_TOOL_CALLS = 3  # Reduced to prevent infinite loops
            headers, model, url = self.get_chat_completion_params(config)

            async def llm_stream_once(msgs):

                # Add tools to the request if available
                request_data = {
                    
                    "messages": msgs,  # ✅ Use the parameter
                    "temperature": 0.7, 
                    "max_tokens": config.MAX_TOKENS, 
                    "stream": True,
                    "model": model
                }

                
                # Add tool definitions if we have any
                if self._tool_registry:
                    tools = []
                    for tool_name, tool_info in self._tool_registry.items():
                        try:
                            
                            # Only register tools that have proper input schemas
                            input_schema = tool_info.get("input_schema", {})
                            if input_schema and "properties" in input_schema:
                                if tool_name in PERMITTED_TOOLS:
                                    tools.append({
                                        "type": "function",
                                        "function": {
                                            "name": tool_name,
                                            "description": tool_info.get("description", f"Tool: {tool_name}"),
                                            "parameters": input_schema
                                        }
                                    })
                        except Exception as e:
                            print(f"Error processing tool {tool_name}: {e}")
                            continue
                
                    if tools:
                        request_data["tools"] = tools
                        request_data["tool_choice"] = "auto"


                async with httpx.AsyncClient(timeout=config.INFERENCE_TIMEOUT) as client:
                    try:
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
                                try:
                                    payload = json.loads(line[6:])
                                    yield payload
                                except json.JSONDecodeError:
                                    if "[DONE]" in line:
                                        break
                                    else:
                                        print(f"Could not decode line: {line}")
                                        continue
                    except httpx.HTTPStatusError as e:
                        print(f"HTTP status error in stream_chat_request: {e}")
                        raise httpx.HTTPStatusError
                    except httpx.TimeoutException as e:
                        print(f"Timeout exception in stream_chat_request: {e}")
                        raise httpx.TimeoutException
                    except httpx.RequestError as e:
                        print(f"Request error in stream_chat_request: {e}")
                        raise httpx.RequestError
                    except Exception as e:
                        print(f"Error in stream_chat_request: {e}")
                        raise e

            tool_calls = 0
            while tool_calls < MAX_TOOL_CALLS:
                partial_text = []
                saw_tool = False
                current_tool_calls = []
                
                async for delta in llm_stream_once(conversation):
                    if "choices" not in delta or not delta["choices"]:
                        continue
                        
                    choice = delta["choices"][0]
                    delta_obj = choice.get("delta", {})
                    
                    # Handle tool calls - accumulate them incrementally
                    if "tool_calls" in delta_obj:
                        saw_tool = True
                        tool_calls_delta = delta_obj["tool_calls"]
                        print(f"📞 Tool calls delta received: {tool_calls_delta}")
                        
                        for tc_delta in tool_calls_delta:
                            tc_index = tc_delta.get("index", 0)
                            
                            # Ensure we have enough tool call slots
                            while len(current_tool_calls) <= tc_index:
                                current_tool_calls.append({
                                    "id": "",
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""}
                                })
                            
                            # Accumulate tool call data incrementally
                            if "id" in tc_delta:
                                current_tool_calls[tc_index]["id"] = tc_delta["id"]
                                print(f"  ✓ Tool call ID: {tc_delta['id']}")
                            
                            if "type" in tc_delta:
                                current_tool_calls[tc_index]["type"] = tc_delta["type"]
                            
                            if "function" in tc_delta:
                                func_delta = tc_delta["function"]
                                if "name" in func_delta:
                                    current_tool_calls[tc_index]["function"]["name"] += func_delta["name"]
                                    print(f"  ✓ Tool name: {current_tool_calls[tc_index]['function']['name']}")
                                if "arguments" in func_delta:
                                    current_tool_calls[tc_index]["function"]["arguments"] += func_delta["arguments"]
                                    print(f"  ✓ Arguments so far: {current_tool_calls[tc_index]['function']['arguments']}")
                    
                    # Handle regular content
                    elif "content" in delta_obj and delta_obj["content"]:
                        content_chunk = delta_obj["content"]
                        partial_text.append(content_chunk)
                        yield content_chunk
                    
                    # Check for finish reason - ONLY execute tools when finish_reason is "tool_calls"
                    finish_reason = choice.get("finish_reason")
                    if finish_reason:
                        print(f"🏁 Finish reason: {finish_reason}")
                        
                        if finish_reason == "tool_calls" and current_tool_calls:
                            print(f"🔧 Executing {len(current_tool_calls)} tool call(s)")
                            
                            # Execute tool calls
                            for tool_call in current_tool_calls:
                                tool_name = tool_call["function"]["name"]
                                tool_args = tool_call["function"]["arguments"]
                                
                                print(f"  📞 Tool: {tool_name}")
                                print(f"  📝 Raw arguments: {tool_args}")
                                
                                if tool_name and tool_args:
                                    try:
                                        args = json.loads(tool_args)
                                        print(f"  ✅ Parsed args: {args}")
                                        
                                        result = await self._call_mcp_tool(tool_name, args, config)
                                        print(f"  ✅ Tool result: {result}")
                                        
                                        # Add tool result to conversation
                                        conversation.append({
                                            "role": "assistant",
                                            "content": None,
                                            "tool_calls": [tool_call]
                                        })
                                        conversation.append(self._tool_result_message(tool_name, result))
                                        
                                    except json.JSONDecodeError as e:
                                        print(f"  ❌ Failed to parse JSON arguments: {e}")
                                        print(f"  ❌ Raw arguments were: {tool_args}")
                                        error_result = {"error": f"Invalid JSON arguments: {str(e)}"}
                                        conversation.append(self._tool_result_message(tool_name, error_result))
                                        break
                                        
                                    except Exception as e:
                                        print(f"  ❌ Error executing tool {tool_name}: {e}")
                                        import traceback
                                        traceback.print_exc()
                                        error_result = {"error": str(e)}
                                        conversation.append(self._tool_result_message(tool_name, error_result))
                                        break
                                else:
                                    print(f"  ⚠️ Skipping incomplete tool call: name={tool_name}, args={tool_args}")
                            
                            tool_calls += 1
                            await asyncio.sleep(0.1)
                            break  # Break inner loop to start new LLM call with tool results
                        
                        elif finish_reason == "stop":
                            print("✅ Regular completion, no more tool calls")
                            # All content has already been yielded chunk by chunk
                            # Just return to exit gracefully
                            return
                
                if not saw_tool:
                    print("✅ No tool calls detected, we're done")
                    # All content has already been yielded chunk by chunk
                    # Just return to exit gracefully
                    return
        except httpx.TimeoutException as e:
            print("Timeout exception in stream_chat_request",e)
            raise httpx.TimeoutException
        
        except httpx.HTTPStatusError as e:
            print(f"HTTP status error in stream_chat_request: {e}")
            raise httpx.HTTPStatusError
        except httpx.RequestError as e:
            print(f"Request error in stream_chat_request {e}")
            raise httpx.RequestError

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
