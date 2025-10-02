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
    
    def __init__(self, gateway_url: str):
        """
        Initialize MCP client
        
        Args:
            gateway_url: URL of the MCP gateway (e.g., "http://gateway:9011/mcp")
        """
        self.gateway_url = gateway_url
        self.session_id: Optional[str] = None
        self.client: Optional[httpx.AsyncClient] = None
        self._tool_cache: Dict[str, dict] = {}
    
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
        Connect to MCP gateway and establish session
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Initialize session
            await self._initialize_session()
            
            # Complete handshake
            await self._send_initialized()
            
            # Cache available tools
            await self._cache_tools()
            
            print(f"✅ Connected to MCP gateway at {self.gateway_url}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to connect to MCP gateway: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from MCP gateway"""
        if self.client:
            await self.client.aclose()
            self.client = None
        self.session_id = None
        self._tool_cache.clear()
        print("✅ Disconnected from MCP gateway")
    
    # ------------------------------------------------------------------------
    # MCP Protocol Implementation
    # ------------------------------------------------------------------------
    
    async def _initialize_session(self) -> Dict[str, Any]:
        """Initialize MCP session (step 1 of handshake)"""
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
        
        response = await self._send_request(init_request)
        
        # Extract session ID from headers
        self.session_id = response.headers.get("mcp-session-id")
        print(f"✅ MCP session initialized with ID: {self.session_id}")
        
        return self._parse_response(response)
    
    async def _send_initialized(self) -> None:
        """Send initialized notification (step 2 of handshake)"""
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        
        response = await self._send_request(initialized_notification)
        
        if response.status_code not in [200, 202]:
            raise Exception(f"Initialized notification failed: {response.status_code}")
        
        print("✅ MCP handshake completed")
    
    async def _cache_tools(self) -> None:
        """Cache available tools from gateway"""
        tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        response = await self._send_request(tools_request)
        result = self._parse_response(response)
        
        if "result" in result and "tools" in result["result"]:
            for tool in result["result"]["tools"]:
                self._tool_cache[tool["name"]] = tool
            
            print(f"✅ Cached {len(self._tool_cache)} tools from MCP gateway")
        else:
            print("⚠️  No tools found in MCP gateway response")
    
    async def _send_request(self, request: dict) -> httpx.Response:
        """
        Send a request to the MCP gateway
        
        Args:
            request: JSON-RPC request object
            
        Returns:
            HTTP response
        """
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        # Add session ID if available
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        if(self.client is None):
            self.client = httpx.AsyncClient(timeout=30.0)
        response = await self.client.post(
            self.gateway_url,
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
        Get list of available tools
        
        Returns:
            List of tool definitions
        """
        if not self._tool_cache:
            await self._cache_tools()
        
        return list(self._tool_cache.values())
    
    async def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific tool
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            Tool definition or None if not found
        """
        if not self._tool_cache:
            await self._cache_tools()
        
        return self._tool_cache.get(tool_name)
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool with the given arguments
        
        Args:
            tool_name: Name of the tool to call
            arguments: Arguments to pass to the tool
            
        Returns:
            Tool execution result
        """
        if not self._tool_cache:
            await self._cache_tools()
        
        if tool_name not in self._tool_cache:
            return {"error": f"Tool '{tool_name}' not found"}
        
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
            response = await self._send_request(call_request)
            result = self._parse_response(response)
            
            # Extract and format the result
            return self._format_tool_result(result)
            
        except Exception as e:
            print(f"❌ Tool call failed: {tool_name} - {e}")
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
        return await self._initialize_session()
    
    async def send_initialized(self) -> None:
        """Legacy method - use connect() instead"""
        await self._send_initialized()
    
    async def list_and_register_tools(self) -> List[Dict[str, Any]]:
        """Legacy method - use list_tools() instead"""
        await self._cache_tools()
        return list(self._tool_cache.values())


# ------------------------------------------------------------------------
# Test Functions
# ------------------------------------------------------------------------

async def test_mcp_client():
    """Test the MCP client functionality"""
    gateway_url = "http://gateway:9011/mcp"
    
    print(f"Testing MCP client with: {gateway_url}")
    
    try:
        async with SimpleMCPClient(gateway_url) as client:
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
                    print(f"Tool result: {result}")
                except Exception as e:
                    print(f"Tool call failed (expected): {e}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_mcp_client())