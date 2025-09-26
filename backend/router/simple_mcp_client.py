#!/usr/bin/env python3
"""
Simple MCP client that works with the gateway
"""
import asyncio
import json
import httpx
from typing import Dict, List, Any

class SimpleMCPClient:
    """Simple MCP client that works with the gateway"""
    
    def __init__(self, url: str):
        self.url = url
        self.session_id = None
        self.client = None
        
    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    async def initialize(self) -> Dict[str, Any]:
        """Initialize MCP session"""
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
                    "name": "simple-mcp-client",
                    "version": "1.0.0"
                }
            }
        }
        
        response = await self.client.post(
            self.url,
            headers={
                "Accept": "application/json, text/event-stream",
                "Content-Type": "application/json"
            },
            json=init_request
        )
        
        if response.status_code != 200:
            raise Exception(f"Initialization failed: {response.status_code} - {response.text}")
        
        # Extract session ID from headers
        self.session_id = response.headers.get("mcp-session-id")
        print(f"✅ MCP session initialized with ID: {self.session_id}")
        
        # Parse the response
        response_text = response.text
        if "data: " in response_text:
            # Extract JSON from SSE format
            lines = response_text.split('\n')
            for line in lines:
                if line.startswith('data: '):
                    json_str = line[6:]  # Remove 'data: ' prefix
                    try:
                        result = json.loads(json_str)
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                raise Exception("No valid JSON found in SSE response")
        else:
            result = response.json()
        
        return result
    
    async def send_initialized(self) -> None:
        """Send initialized notification to complete the handshake"""
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        # Add session ID if available
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        
        response = await self.client.post(
            self.url,
            headers=headers,
            json=initialized_notification
        )
        
        if response.status_code not in [200, 202]:
            raise Exception(f"Initialized notification failed: {response.status_code} - {response.text}")
        
        print("✅ Initialized notification sent")
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools"""
        tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        # Add session ID if available
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        
        response = await self.client.post(
            self.url,
            headers=headers,
            json=tools_request
        )
        
        if response.status_code != 200:
            raise Exception(f"List tools failed: {response.status_code} - {response.text}")
        
        print(f"Tools list response: {response.text}")
        
        # Parse the response
        response_text = response.text
        if "data: " in response_text:
            # Extract JSON from SSE format
            lines = response_text.split('\n')
            for line in lines:
                if line.startswith('data: '):
                    json_str = line[6:]  # Remove 'data: ' prefix
                    try:
                        result = json.loads(json_str)
                        print(f"Parsed tools result: {result}")
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                raise Exception("No valid JSON found in SSE response")
        else:
            result = response.json()
            print(f"Parsed tools result: {result}")
        
        if "result" in result and "tools" in result["result"]:
            return result["result"]["tools"]
        else:
            return []
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool"""
        call_request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        # Add session ID if available
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        
        response = await self.client.post(
            self.url,
            headers=headers,
            json=call_request
        )
        
        if response.status_code != 200:
            raise Exception(f"Tool call failed: {response.status_code} - {response.text}")
        
        # Parse the response
        response_text = response.text
        if "data: " in response_text:
            # Extract JSON from SSE format
            lines = response_text.split('\n')
            for line in lines:
                if line.startswith('data: '):
                    json_str = line[6:]  # Remove 'data: ' prefix
                    try:
                        result = json.loads(json_str)
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                raise Exception("No valid JSON found in SSE response")
        else:
            result = response.json()
        
        return result

async def test_simple_client():
    """Test the simple MCP client"""
    mcp_host = "http://gateway:9011/mcp"
    
    print(f"Testing simple MCP client with: {mcp_host}")
    
    try:
        async with SimpleMCPClient(mcp_host) as client:
            # Initialize
            result = await client.initialize()
            print(f"✅ Initialization result: {result}")
            
            # Send initialized notification
            await client.send_initialized()
            
            # List tools
            tools = await client.list_tools()
            print(f"✅ Available tools: {len(tools)}")
            for tool in tools:
                print(f"  - {tool.get('name', 'unknown')}: {tool.get('description', 'no description')}")
            
            # Test a tool call if available
            if tools:
                tool_name = tools[0].get('name')
                if tool_name:
                    print(f"Testing tool: {tool_name}")
                    try:
                        result = await client.call_tool(tool_name, {})
                        print(f"✅ Tool call result: {result}")
                    except Exception as e:
                        print(f"❌ Tool call failed: {e}")
                        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_simple_client())
