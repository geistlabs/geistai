#!/usr/bin/env python3
"""
Direct test of MCP gateway connection
"""
import asyncio
import httpx
import mcp_patch  # Apply monkey patch for Accept header
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def test_gateway_direct():
    """Test direct connection to MCP gateway"""
    mcp_host = "http://gateway:9011/mcp"
    
    print(f"Testing direct connection to: {mcp_host}")
    
    try:
        # Test basic connectivity
        print("1. Testing basic connectivity...")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(mcp_host)
            print(f"   GET response: {response.status_code}")
        
        # Test POST connectivity
        print("2. Testing POST connectivity...")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(mcp_host, headers={"Accept": "text/event-stream"})
            print(f"   POST response: {response.status_code}")
            print(f"   Response headers: {dict(response.headers)}")
            print(f"   Response body: {response.text}")
        
        # Test MCP connection
        print("3. Testing MCP connection...")
        async with streamablehttp_client(mcp_host) as (read_stream, write_stream, _):
            print("   ✅ Streamable HTTP connection established")
            
            session = ClientSession(read_stream, write_stream)
            print("   ✅ Session created")
            
            print("   Initializing session...")
            try:
                result = await asyncio.wait_for(session.initialize(), timeout=10.0)
                print(f"   ✅ Session initialized: {result}")
                
                # Try to list tools
                print("   Listing tools...")
                tools_response = await session.list_tools()
                print(f"   ✅ Tools listed: {len(tools_response.tools)} tools")
                for tool in tools_response.tools:
                    print(f"     - {tool.name}: {tool.description}")
                    
            except asyncio.TimeoutError:
                print("   ❌ Session initialization timed out")
            except Exception as e:
                print(f"   ❌ Session initialization failed: {e}")
                import traceback
                traceback.print_exc()
                
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_gateway_direct())
