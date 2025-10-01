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
    
    gpt_service = GptService(config)
    
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


if __name__ == "__main__":
    asyncio.run(test_mcp_initialization())
