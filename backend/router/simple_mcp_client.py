"""
Simple MCP Client - Handles communication with MCP Gateway

This client provides a clean interface for:
1. Connecting to MCP Gateway
2. Listing available tools
3. Calling tools
4. Managing sessions

ARCHITECTURE:
- Handles MCP protocol details (JSON-RPC, SSE parsing)
- Provides simple async interface for tool operations
- Manages session state and connection lifecycle
- Abstracts away MCP protocol complexity
"""

import asyncio
import json
import httpx
from typing import Dict, List, Any, Optional


class SimpleMCPClient:
    """
    Simple client for communicating with MCP Gateway

    This client handles the MCP protocol details and provides
    a clean async interface for tool operations.
    """

    def __init__(self, gateway_urls: list[str]):
        """
        Initialize MCP client

        Args:
            gateway_urls: List of MCP gateway URLs (e.g., ["http://gateway1:9011/mcp", "http://gateway2:9011/mcp"])
        """
        self.gateway_urls = gateway_urls
        self.sessions: Dict[str, str] = {}  # gateway_url -> session_id
        self.client: Optional[httpx.AsyncClient] = None
        self._tool_cache: Dict[str, dict] = {}  # tool_name -> {tool_info, gateway_url}

    # ------------------------------------------------------------------------
    # Connection Management
    # ------------------------------------------------------------------------

    async def __aenter__(self):
        """Async context manager entry"""
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.client:
            await self.client.aclose()
            self.client = None

    async def connect(self) -> bool:
        """
        Connect to all MCP gateways and establish sessions

        Returns:
            True if at least one connection successful, False otherwise
        """
        try:
            success_count = 0

            for gateway_url in self.gateway_urls:
                try:
                    # Initialize session for this gateway
                    session_id = await self._initialize_session(gateway_url)
                    if not session_id:
                        continue

                    # Complete handshake
                    await self._send_initialized(gateway_url, session_id)

                    # Cache available tools from this gateway
                    await self._cache_tools(gateway_url, session_id)

                    # Store session
                    self.sessions[gateway_url] = session_id
                    success_count += 1

                    print(f"✅ Connected to MCP gateway at {gateway_url}")

                except Exception as e:
                    print(f"❌ Failed to connect to gateway {gateway_url}: {e}")
                    continue

            if success_count > 0:
                print(f"✅ Connected to {success_count}/{len(self.gateway_urls)} MCP gateways")
                return True
            else:
                print("❌ Failed to connect to any MCP gateways")
                return False

        except Exception as e:
            print(f"❌ Failed to connect to MCP gateways: {e}")
            return False

    async def disconnect(self):
        """Disconnect from all MCP gateways"""
        if self.client:
            await self.client.aclose()
            self.client = None
        self.sessions.clear()
        self._tool_cache.clear()
        print("✅ Disconnected from all MCP gateways")

    # ------------------------------------------------------------------------
    # MCP Protocol Implementation
    # ------------------------------------------------------------------------

    async def _initialize_session(self, gateway_url: str) -> Optional[str]:
        """Initialize MCP session (step 1 of handshake)"""
        print(f"Initializing MCP session with {gateway_url}")
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {
                    "sampling": {},
                    "elicitation": {},
                    "experimental": {}
                },
                "clientInfo": {
                    "name": "geist-router",
                    "version": "1.0.0"
                }
            }
        }

        response = await self._send_request(gateway_url, init_request)

        # Extract session ID from headers
        session_id = response.headers.get("mcp-session-id")
        print(f"✅ MCP session initialized with ID: {session_id}")

        return session_id

    async def _send_initialized(self, gateway_url: str, session_id: str) -> None:
        """Send initialized notification (step 2 of handshake)"""
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }

        response = await self._send_request(gateway_url, initialized_notification, session_id)

        if response.status_code not in [200, 202]:
            raise Exception(f"Initialized notification failed: {response.status_code}")

        print("✅ MCP handshake completed")

    async def _cache_tools(self, gateway_url: str, session_id: str) -> None:
        """Cache available tools from gateway"""
        tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }

        response = await self._send_request(gateway_url, tools_request, session_id)
        result = self._parse_response(response)

        if "result" in result and "tools" in result["result"]:
            for tool in result["result"]["tools"]:
                # Store tool with its gateway URL for routing
                self._tool_cache[tool["name"]] = {
                    "tool_info": tool,
                    "gateway_url": gateway_url
                }
            print(f"✅ Cached {len(result['result']['tools'])} tools from {gateway_url}")
        else:
            print(f"⚠️  No tools found in MCP gateway response from {gateway_url}")

    async def _send_request(self, gateway_url: str, request: dict, session_id: Optional[str] = None) -> httpx.Response:
        """
        Send a request to a specific MCP gateway

        Args:
            gateway_url: URL of the MCP gateway
            request: JSON-RPC request object
            session_id: Optional session ID for the request

        Returns:
            HTTP response
        """
        print(f"Sending request to {gateway_url}: {request}")
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }

        # Add session ID if available
        if session_id:
            headers["mcp-session-id"] = session_id

        if self.client is None:
            self.client = httpx.AsyncClient(timeout=30.0)

        response = await self.client.post(
            gateway_url,
            headers=headers,
            json=request
        )

        if response.status_code not in [200, 202]:
            raise Exception(f"MCP request failed: {response.status_code} - {response.text}")

        return response

    def _parse_response(self, response: httpx.Response) -> dict:
        """
        Parse MCP response (handles both JSON and SSE formats)

        Args:
            response: HTTP response from MCP gateway

        Returns:
            Parsed JSON object
        """
        response_text = response.text

        # Handle SSE format (data: {...})
        if "data: " in response_text:
            lines = response_text.split('\n')
            for line in lines:
                if line.startswith('data: '):
                    json_str = line[6:]  # Remove 'data: ' prefix
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        continue
            raise Exception("No valid JSON found in SSE response")

        # Handle regular JSON format
        else:
            return response.json()

    # ------------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------------

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        Get list of available tools from all gateways

        Returns:
            List of tool definitions
        """
        if not self._tool_cache:
            # If no tools cached, try to connect to all gateways
            await self.connect()

        # Return just the tool info, hiding the gateway URL from users
        return [tool_data["tool_info"] for tool_data in self._tool_cache.values()]

    async def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific tool

        Args:
            tool_name: Name of the tool

        Returns:
            Tool definition or None if not found
        """
        if not self._tool_cache:
            # If no tools cached, try to connect to all gateways
            await self.connect()

        tool_data = self._tool_cache.get(tool_name)
        return tool_data["tool_info"] if tool_data else None

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool with the given arguments

        Args:
            tool_name: Name of the tool to call
            arguments: Arguments to pass to the tool

        Returns:
            Tool execution result
        """
        print(f"🔧 MCP call_tool: {tool_name}")
        print(f"   Arguments: {arguments}")

        if not self._tool_cache:
            # If no tools cached, try to connect to all gateways
            print(f"   ⚠️  No tools cached, connecting...")
            await self.connect()

        if tool_name not in self._tool_cache:
            print(f"   ❌ Tool not found in cache")
            return {"error": f"Tool '{tool_name}' not found"}

        # Get the gateway URL and session ID for this tool
        tool_data = self._tool_cache[tool_name]
        gateway_url = tool_data["gateway_url"]
        session_id = self.sessions.get(gateway_url)

        print(f"   Gateway: {gateway_url}")
        print(f"   Session ID: {session_id}")

        if not session_id:
            print(f"   ❌ No active session")
            return {"error": f"No active session for gateway {gateway_url}"}

        call_request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        try:
            print(f"   📤 Sending MCP request...")
            response = await self._send_request(gateway_url, call_request, session_id)
            print(f"   📥 Response received: {response.status_code}")

            result = self._parse_response(response)
            print(f"   ✅ Result parsed successfully")

            # Extract and format the result
            formatted = self._format_tool_result(result)
            print(f"   ✅ Tool call completed")
            return formatted

        except Exception as e:
            print(f"❌ Tool call failed: {tool_name} - {e}")
            import traceback
            traceback.print_exc()
            return {"error": f"Tool call failed: {str(e)}"}

    def _format_tool_result(self, result: dict) -> dict:
        """
        Format tool result into a consistent structure

        Args:
            result: Raw result from MCP gateway

        Returns:
            Formatted result with 'content' or 'error' key
        """
        # Handle MCP result format
        if "result" in result and "content" in result["result"]:
            content_parts = []
            for item in result["result"]["content"]:
                if isinstance(item, dict):
                    if "text" in item:
                        content_parts.append(item["text"])
                    elif "data" in item:
                        content_parts.append(str(item["data"]))
                    else:
                        content_parts.append(str(item))
                else:
                    content_parts.append(str(item))

            return {
                "content": "\n".join(content_parts),
                "status": "success"
            }

        # Handle error format
        elif "error" in result:
            return {
                "error": result["error"].get("message", str(result["error"])),
                "status": "error"
            }

        # Handle unknown format
        else:
            return {
                "content": json.dumps(result, ensure_ascii=False),
                "status": "success"
            }

    # ------------------------------------------------------------------------
    # Legacy API (for backward compatibility)
    # ------------------------------------------------------------------------

    async def initialize(self) -> Dict[str, Any]:
        """Legacy method - use connect() instead"""
        # This method is deprecated - use connect() instead
        raise NotImplementedError("Use connect() method instead")

    async def send_initialized(self) -> None:
        """Legacy method - use connect() instead"""
        # This method is deprecated - use connect() instead
        raise NotImplementedError("Use connect() method instead")

    async def list_and_register_tools(self) -> List[Dict[str, Any]]:
        """Legacy method - use list_tools() instead"""
        # This method is deprecated - use list_tools() instead
        raise NotImplementedError("Use list_tools() method instead")


# ------------------------------------------------------------------------
# Test Functions
# ------------------------------------------------------------------------

async def test_mcp_client():
    """Test the MCP client functionality"""
    brave_and_fetch = ["http://mcp-brave:3000", "http://mcp-fetch:8000"]

    print(f"Testing MCP client with: {brave_and_fetch}")

    try:
        async with SimpleMCPClient(brave_and_fetch) as client:
            # Connect to gateway
            if not await client.connect():
                print("❌ Failed to connect to MCP gateway")
                return

            # List available tools
            tools = await client.list_tools()
            print(f"✅ Found {len(tools)} tools:")
            for tool in tools:
                print(f"  - {tool['name']}: {tool.get('description', 'No description')}")

            # Test a tool call if tools are available
            if tools:
                tool_name = tools[0]['name']
                print(f"\n🔧 Testing tool: {tool_name}")

                # Get tool info
                tool_info = await client.get_tool_info(tool_name)
                if tool_info:
                    print(f"Tool schema: {tool_info.get('inputSchema', {})}")

                # Try a simple call (may fail depending on tool requirements)
                try:
                    result = await client.call_tool(tool_name, {})
                except Exception as e:
                    print(f"Tool call failed (expected): {e}")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_mcp_client())
