"""
Agent Registry - Helper functions to register agents as tools

This module provides easy ways to add agent tools to your GPT service.
"""

from typing import List, Dict, Any
from gpt_service import GptService
from agent_tool import AgentTool, get_predefined_agents, create_custom_agent



async def register_predefined_agents(gpt_service: GptService, config) -> List[str]:
    """
    Register all predefined agents as tools
    
    Args:
        gpt_service: The GPT service to register agents with
        config: Configuration object
        
    Returns:
        List of registered agent names
    """
    agents = get_predefined_agents(config)
    registered = []
    
    for agent in agents:
        # Initialize the agent
        await agent.initialize(gpt_service, config)
        
        # Register as a tool
        gpt_service._register_tool(
            name=agent.name,
            description=agent.description,
            input_schema=agent.get_tool_definition()["function"]["parameters"],
            executor=agent.execute,
            tool_type="agent"
        )
        
        registered.append(agent.name)
    
    return registered


async def register_custom_agent(
    gpt_service: GptService,
    config,
    name: str,
    description: str,
    system_prompt: str,
    available_tools: List[str],
    reasoning_effort: str = "medium"
) -> str:
    """
    Register a custom agent as a tool
    
    Args:
        gpt_service: The GPT service to register the agent with
        config: Configuration object
        name: Unique name for the agent
        description: What the agent does
        system_prompt: Custom system prompt
        available_tools: List of tool names the agent can use
        reasoning_effort: "low", "medium", or "high"
        model_config: Model configuration overrides
        
    Returns:
        str: The registered agent name
    """
    # Create the agent
    agent = create_custom_agent(
        name=name,
        description=description,
        system_prompt=system_prompt,
        model_config=config,
        available_tools=available_tools,
        reasoning_effort=reasoning_effort,
    )
    
    # Initialize the agent
    await agent.initialize(gpt_service, config)
    
    # Register as a tool
    gpt_service._register_tool(
        name=agent.name,
        description=agent.description,
        input_schema=agent.get_tool_definition()["function"]["parameters"],
        executor=agent.execute,
        tool_type="agent"
    )
    
    return agent.name


async def register_specific_agents(
    gpt_service: GptService,
    config,
    agent_names: List[str]
) -> List[str]:
    """
    Register only specific predefined agents
    
    Args:
        gpt_service: The GPT service to register agents with
        config: Configuration object
        agent_names: List of agent names to register
        
    Returns:
        List of registered agent names
    """
    all_agents = get_predefined_agents(config)
    agent_map = {agent.name: agent for agent in all_agents}
    registered = []
    
    for agent_name in agent_names:
        if agent_name not in agent_map:
            continue
        
        agent = agent_map[agent_name]
        
        # Initialize the agent
        await agent.initialize(gpt_service, config)
        
        # Register as a tool
        gpt_service._register_tool(
            name=agent.name,
            description=agent.description,
            input_schema=agent.get_tool_definition()["function"]["parameters"],
            executor=agent.execute,
            tool_type="agent"
        )
        
        registered.append(agent.name)
    
    return registered


