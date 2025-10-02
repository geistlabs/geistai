"""
Agent Tool - A configurable sub-agent that can be used as a tool

This allows you to create specialized agents with different:
- System prompts
- Available tools
- Reasoning levels
- Model configurations

Usage:
1. Create an agent instance with your desired configuration
2. Register it as a tool in your main GPT service
3. The LLM can now delegate tasks to specialized agents
"""

import json
import asyncio
from typing import Dict, List, Any, Optional
import httpx
from gpt_service import GptService


class AgentTool:
    """
    A configurable agent that can be used as a tool by the main GPT service
    
    This creates a sub-agent with its own:
    - System prompt
    - Available tools
    - Reasoning level
    - Model configuration
    """
    
    def __init__(
        self,
        model_config: Dict[str, Any],
        name: str,
        description: str,
        system_prompt: str,
        available_tools: List[str],
        reasoning_effort: str = "medium",
    ):
        """
        Initialize the agent tool
        
        Args:
            name: Unique name for this agent
            description: What this agent does (shown to main LLM)
            system_prompt: The system prompt for this agent
            available_tools: List of tool names this agent can use (None = all tools)
            reasoning_effort: "low", "medium", or "high"
            model_config: Override model configuration for this agent
        """
        self.name = name
        self.description = description
        self.system_prompt = system_prompt
        self.available_tools = available_tools or []
        self.reasoning_effort = reasoning_effort
        self.model_config = model_config or {}
        
        # Create a GPT service instance for this agent
        self.gpt_service = GptService(model_config)
        
        # Tool registry for this agent (will be populated when initialized)
        self._agent_tool_registry: Dict[str, dict] = {}
    
    async def initialize(self, main_gpt_service: GptService, config):
        """
        Initialize the agent with tools from the main GPT service
        
        Args:
            main_gpt_service: The main GPT service to get tools from
            config: Configuration object
        """
        # Copy tools from main service, filtered by available_tools
        if self.available_tools:
            # Only include specified tools
            for tool_name in self.available_tools:
                if tool_name in main_gpt_service._tool_registry:
                    self._agent_tool_registry[tool_name] = main_gpt_service._tool_registry[tool_name]
        else:
            # Include all tools from main service
            self._agent_tool_registry = main_gpt_service._tool_registry.copy()
        
        # Initialize the agent's GPT service with the filtered tools
        self.gpt_service._tool_registry = self._agent_tool_registry
        self.gpt_service._mcp_client = main_gpt_service._mcp_client
        
        print(f"✅ Initialized agent '{self.name}' with {len(self._agent_tool_registry)} tools")
    
    def get_tool_definition(self) -> dict:
        """
        Get the tool definition for this agent (to register with main GPT service)
        
        Returns:
            dict: Tool definition in OpenAI function calling format
        """
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task": {
                            "type": "string",
                            "description": "The task or question to give to this agent"
                        },
                        "context": {
                            "type": "string",
                            "description": "Additional context or background information",
                            "default": ""
                        }
                    },
                    "required": ["task"]
                }
            }
        }
    
    async def execute(self, arguments: dict) -> dict:
        """
        Execute the agent tool
        
        Args:
            arguments: dict with 'task' and optional 'context'
            
        Returns:
            dict: Agent's response with 'content' key
        """
        task = arguments.get("task", "")
        context = arguments.get("context", "")
        
        if not task:
            return {"error": "No task provided"}
        
        try:
            # Prepare the conversation
            messages = []
            
            # Add context if provided
            if context:
                messages.append({
                    "role": "user",
                    "content": f"Context: {context}\n\nTask: {task}"
                })
            else:
                messages.append({
                    "role": "user",
                    "content": task
                })
            
            # Override system prompt
            original_prepare = self.gpt_service.prepare_conversation_messages
            
            def custom_prepare(messages, reasoning_effort="medium"):
                # Use our custom system prompt instead of the default
                result_messages = []
                has_system = any(msg.get("role") == "system" for msg in messages)
                
                if not has_system:
                    result_messages.append({"role": "system", "content": self.system_prompt})
                    result_messages.extend(messages)
                else:
                    for msg in messages:
                        if msg.get("role") == "system":
                            # Replace system message with our custom prompt
                            result_messages.append({"role": "system", "content": self.system_prompt})
                        else:
                            result_messages.append(msg)
                
                return result_messages
            
            # Temporarily override the prepare method
            self.gpt_service.prepare_conversation_messages = custom_prepare
            
            # Get response from agent using streaming
            response_chunks = []
            async for chunk in self.gpt_service.stream_chat_request(
                messages=messages,
                reasoning_effort=self.reasoning_effort,
                permitted_tools=self.available_tools,
                chat_initiator=self.name
            ):
                response_chunks.append(chunk)
            
            # Combine all chunks into final response
            response = "".join(response_chunks)
            
            # Restore original method
            self.gpt_service.prepare_conversation_messages = original_prepare
            
            return {
                "content": response,
                "agent": self.name,
                "status": "success"
            }
            
        except Exception as e:
            return {
                "error": f"Agent execution failed: {str(e)}",
                "agent": self.name,
                "status": "error"
            }


# ============================================================================
# PREDEFINED AGENTS
# ============================================================================

def create_research_agent(config) -> AgentTool:
    """Create a research-focused agent"""
    return AgentTool(
        config,
        name="research_agent",
        description="Use this tool to research the web using brave search. To be used to search the web, analyze information, and provide detailed research reports.",
        system_prompt=(
            "You are a research specialist. Your role is to:\n"
            "- Conduct thorough research on given topics\n"
            "- Use web search tools to find current information\n"
            "- Analyze and synthesize information from multiple sources\n"
            "- Provide well-structured, factual reports\n"
            "- Always cite your sources when possible\n\n"
            "Be thorough, accurate, and objective in your research."
            "You always find the results, using fetch tool if needed"
        ),
        available_tools=["brave_web_search", "fetch"],  # Only allow search tools
        reasoning_effort="high"
    )


def create_creative_agent(config) -> AgentTool:
    """Create a creative writing agent"""
    return AgentTool(
        config,
        name="creative_agent",
        description="A specialized agent for creative writing tasks. Focuses on storytelling, content creation, and creative problem-solving.",
        system_prompt=(
            "You are a creative writing specialist. Your role is to:\n"
            "- Write engaging, creative content\n"
            "- Develop compelling narratives and stories\n"
            "- Generate creative solutions to problems\n"
            "- Use vivid language and imaginative thinking\n"
            "- Adapt your writing style to the audience and purpose\n\n"
            "Be creative, engaging, and original in your approach."
        ),
        available_tools=[],  # No external tools, just creative thinking
        reasoning_effort="medium"
    )


def create_technical_agent(config) -> AgentTool:
    """Create a technical analysis agent"""
    return AgentTool(
        config,
        name="technical_agent",
        description="A specialized agent for technical analysis, coding, and problem-solving. Can analyze code, debug issues, and provide technical solutions.",
        system_prompt=(
            "You are a technical specialist. Your role is to:\n"
            "- Analyze technical problems and provide solutions\n"
            "- Review and debug code\n"
            "- Explain complex technical concepts clearly\n"
            "- Provide step-by-step technical guidance\n"
            "- Focus on accuracy and best practices\n\n"
            "Be precise, logical, and thorough in your technical analysis."
        ),
        available_tools=[],  # Could add code analysis tools here
        reasoning_effort="high"
    )


def create_summary_agent(config) -> AgentTool:
    """Create a summarization agent"""
    return AgentTool(
        config,
        name="summary_agent",
        description="A specialized agent for summarizing information. Can condense long texts, extract key points, and create concise summaries.",
        system_prompt=(
            "You are a summarization specialist. Your role is to:\n"
            "- Create clear, concise summaries of information\n"
            "- Extract key points and main ideas\n"
            "- Maintain accuracy while reducing length\n"
            "- Adapt summary length to the requested format\n"
            "- Preserve important details and context\n\n"
            "Be concise, accurate, and comprehensive in your summaries."
        ),
        available_tools=[],
        reasoning_effort="medium"
    )


# ============================================================================
# AGENT REGISTRY
# ============================================================================

def get_predefined_agents(config) -> List[AgentTool]:
    """Get all predefined agents"""
    return [
        create_research_agent(config),
        create_creative_agent(config),
        create_technical_agent(config),
        create_summary_agent(config)
    ]


def create_custom_agent(
    name: str,
    description: str,
    system_prompt: str,
    model_config: Dict[str, Any],
    available_tools: List[str],
    reasoning_effort: str = "medium",
) -> AgentTool:
    """
    Create a custom agent with your own configuration
    
    Args:
        name: Unique name for the agent
        description: What the agent does
        system_prompt: Custom system prompt
        available_tools: List of tool names the agent can use
        reasoning_effort: "low", "medium", or "high"
        model_config: Model configuration overrides
        
    Returns:
        AgentTool: Configured agent ready to be registered
    """
    return AgentTool(
        model_config=model_config,
        name=name,
        description=description,
        system_prompt=system_prompt,
        available_tools=available_tools,
        reasoning_effort=reasoning_effort,
    )
