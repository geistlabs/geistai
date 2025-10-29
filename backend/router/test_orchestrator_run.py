#!/usr/bin/env python3
"""
Test script to run the orchestrator directly
"""

import asyncio
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_orchestrator_run():
    """Test running the orchestrator directly"""

    print("🧪 Testing orchestrator run directly...")

    try:
        from main import create_pricing_agent, get_gpt_service
        from chat_types import ChatMessage
        import config

        # Set up components
        pricing_agent = create_pricing_agent()
        gpt_service = await get_gpt_service()
        gpt_service._tool_registry["pricing_negotiation"] = pricing_agent

        # Create orchestrator
        from nested_orchestrator import NestedOrchestrator
        orchestrator = NestedOrchestrator(
            model_config=config,
            name="pricing_orchestrator",
            description="Pricing negotiation orchestrator",
            system_prompt="You are a pricing specialist. Help users find the right GeistAI subscription plan.",
            available_tools=["pricing_negotiation"]
        )

        orchestrator.gpt_service = gpt_service
        await orchestrator.initialize(gpt_service, config)

        # Create test messages
        messages = [ChatMessage(role="user", content="Hello, I need pricing help")]

        print("🚀 Running orchestrator...")

        # Set up event listeners
        def on_orchestrator_start(data):
            print(f"🎬 Orchestrator started: {data}")

        def on_agent_token(data):
            print(f"📝 Agent token: {data}")

        def on_orchestrator_complete(data):
            print(f"✅ Orchestrator completed: {data}")

        def on_sub_agent_event(data):
            print(f"🤖 Sub-agent event: {data}")

        def on_tool_call_event(data):
            print(f"🔧 Tool call event: {data}")

        # Register event listeners
        orchestrator.on("orchestrator_start", on_orchestrator_start)
        orchestrator.on("agent_token", on_agent_token)
        orchestrator.on("orchestrator_complete", on_orchestrator_complete)
        orchestrator.on("sub_agent_event", on_sub_agent_event)
        orchestrator.on("tool_call_event", on_tool_call_event)

        # Run the orchestrator
        result = await orchestrator.run(messages)

        print(f"🎉 Orchestrator completed with result: {result}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_orchestrator_run())
