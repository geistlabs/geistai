#!/usr/bin/env python3
"""
Test script for MCP functionality in GptService
"""
import asyncio
import os
from gpt_service import GptService
import config

async def test_mcp_initialization():
    """Test MCP initialization"""
    print("Testing MCP initialization...")
    print(f"Current working directory: {os.getcwd()}")
    
    gpt_service = GptService()
    
    try:
        await gpt_service.init_mcp(config)
        print(f"✅ MCP initialized successfully!")
        print(f"Available tools: {list(gpt_service._tool_registry.keys())}")
        
        if gpt_service._tool_registry:
            print("✅ Tools registered successfully!")
            
            # Test each tool
            for tool_name, tool_info in gpt_service._tool_registry.items():
                print(f"  - {tool_name}: {tool_info.get('description', 'No description')}")
        else:
            print("⚠️  No tools registered")
            print("This could mean:")
            print("  - MCP servers aren't running (if in Docker)")
            print("  - Node.js/npx not available (if running locally)")
            print("  - Network connectivity issues")
            
    except Exception as e:
        print(f"❌ MCP initialization failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await gpt_service.shutdown_mcp()
        print("✅ MCP shutdown completed")

async def test_tool_call():
    """Test calling a tool if available"""
    print("\nTesting tool call...")
    
    gpt_service = GptService()
    
    try:
        await gpt_service.init_mcp(config)
        
        if gpt_service._tool_registry:
            # Try to call the first available tool
            tool_name = next(iter(gpt_service._tool_registry.keys()))
            print(f"Testing tool: {tool_name}")
            
            if "search" in tool_name.lower():
                result = await gpt_service._call_mcp_tool(tool_name, {"query": "test search"})
            elif "fetch" in tool_name.lower():
                result = await gpt_service._call_mcp_tool(tool_name, {"url": "https://httpbin.org/get"})
            else:
                print(f"Don't know how to test tool: {tool_name}")
                return
                
            print(f"Tool result: {result}")
        else:
            print("No tools available to test")
            
    except Exception as e:
        print(f"❌ Tool call failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await gpt_service.shutdown_mcp()

if __name__ == "__main__":
    asyncio.run(test_mcp_initialization())
    asyncio.run(test_tool_call())
