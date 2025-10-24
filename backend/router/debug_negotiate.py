#!/usr/bin/env python3
"""
Debug script to test the negotiate endpoint components
"""

import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def debug_negotiate_components():
    """Debug each component of the negotiate endpoint"""

    print("🔍 Debugging negotiate endpoint components...")

    try:
        # Test 1: Import main modules
        print("1️⃣ Testing imports...")
        from main import app, create_pricing_agent, NestedOrchestrator, get_gpt_service
        from chat_types import ChatMessage
        import config
        print("✅ Imports successful")

        # Test 2: Create pricing agent
        print("2️⃣ Testing pricing agent creation...")
        pricing_agent = create_pricing_agent()
        print(f"✅ Pricing agent created: {pricing_agent.name}")
        print(f"   Description: {pricing_agent.description}")
        print(f"   Available tools: {pricing_agent.available_tools}")

        # Test 3: Get GPT service
        print("3️⃣ Testing GPT service...")
        gpt_service = await get_gpt_service()
        print(f"✅ GPT service created: {type(gpt_service)}")

        # Test 4: Register pricing agent
        print("4️⃣ Testing pricing agent registration...")
        gpt_service._tool_registry["pricing_negotiation"] = pricing_agent
        print(f"✅ Pricing agent registered. Tool registry keys: {list(gpt_service._tool_registry.keys())}")

        # Test 5: Create orchestrator
        print("5️⃣ Testing orchestrator creation...")
        orchestrator = NestedOrchestrator(
            model_config=config,
            name="pricing_orchestrator",
            description="Pricing negotiation orchestrator",
            system_prompt="You are a pricing specialist. Help users find the right GeistAI subscription plan.",
            available_tools=["pricing_negotiation"]
        )
        print(f"✅ Orchestrator created: {orchestrator.name}")

        # Test 6: Set up orchestrator
        print("6️⃣ Testing orchestrator setup...")
        orchestrator.gpt_service = gpt_service
        print("✅ Orchestrator GPT service set")

        # Test 7: Test message creation
        print("7️⃣ Testing message creation...")
        messages = [ChatMessage(role="user", content="Hello, I need pricing help")]
        print(f"✅ Messages created: {len(messages)} messages")

        # Test 8: Test orchestrator initialization
        print("8️⃣ Testing orchestrator initialization...")
        await orchestrator.initialize(gpt_service, config)
        print("✅ Orchestrator initialized")

        print("🎉 All components working correctly!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_negotiate_components())
