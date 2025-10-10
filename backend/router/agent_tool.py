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

from datetime import datetime
import json
import asyncio
from typing import Dict, List, Any, Optional
import httpx
from gpt_service import GptService
from response_schema import AgentResponse, Citation, convert_legacy_citations, convert_to_legacy_citations
from events import EventEmitter


class AgentTool(EventEmitter):
    """
    A configurable agent that can be used as a tool by the main GPT service

    This creates a sub-agent with its own:
    - System prompt
    - Available tools
    - Reasoning level
    - Model configuration
    - Event streaming capabilities
    """

    def __init__(
        self,
        model_config: Dict[str, Any],
        name: str,
        description: str,
        system_prompt: str,
        available_tools: List[str],
        reasoning_effort: str = "medium",
        stream_sub_agents: bool = True,
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
            stream_sub_agents: Whether to emit streaming events for sub-agent activities
        """
        super().__init__()
        self.name = name
        self.description = description
        self.system_prompt = system_prompt
        self.available_tools = available_tools or []
        self.reasoning_effort = reasoning_effort
        self.model_config = model_config or {}
        self.stream_sub_agents = stream_sub_agents

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

    async def run(self, input_data: str, context: str = "") -> AgentResponse:
        """
        Run the agent with structured response and event streaming
        
        Args:
            input_data: The task or question to give to this agent
            context: Additional context or background information
            
        Returns:
            AgentResponse with text, citations, and metadata
        """
        # Emit start event
        print(f"🎯 AgentTool {self.name} emitting agent_start event")
        self.emit("agent_start", {
            "agent": self.name,
            "input": input_data,
            "context": context
        })
        
        try:
            # Prepare the conversation
            messages = []
            
            # Add context if provided
            if context:
                messages.append({
                    "role": "user",
                    "content": f"Context: {context}\n\nTask: {input_data}"
                })
            else:
                messages.append({
                    "role": "user",
                    "content": input_data
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
            citations = []
            
            async for chunk, new_citations in self.gpt_service.stream_chat_request(
                messages=messages,
                reasoning_effort=self.reasoning_effort,
                agent_name=self.name,
                permitted_tools=self.available_tools,
            ):
                response_chunks.append(chunk)
                
                # Emit token event for streaming
                self.emit("agent_token", {
                    "agent": self.name,
                    "content": chunk
                })
                
                # Handle citations
                def citation_key(c):
                    return (c.get("url"), c.get("number"))
                existing_keys = set(citation_key(c) for c in citations)
                for nc in new_citations:
                    if citation_key(nc) not in existing_keys:
                        citations.append(nc)
                        existing_keys.add(citation_key(nc))
            
            # Combine all chunks into final response
            response_text = "".join(response_chunks)

            # Restore original method
            self.gpt_service.prepare_conversation_messages = original_prepare

            # Convert legacy citations to new format
            structured_citations = convert_legacy_citations(citations)

            # Handle empty responses
            if not response_text or response_text.strip() == "":
                agent_response = AgentResponse(
                    text="",
                    citations=structured_citations,
                    agent_name=self.name,
                    status="empty_response",
                    meta={
                        "error": f"Agent {self.name} completed tool execution but produced no content. This may indicate a Harmony format issue where reasoning_content was generated but no final content channel was used."
                    }
                )
            else:
                agent_response = AgentResponse(
                    text=response_text,
                    citations=structured_citations,
                    agent_name=self.name,
                    status="success",
                    meta={"reasoning_effort": self.reasoning_effort}
                )

            # Emit completion event
            print(f"🎯 AgentTool {self.name} emitting agent_complete event")
            self.emit("agent_complete", {
                "agent": self.name,
                "text": agent_response.text,
                "citations": convert_to_legacy_citations(agent_response.citations or []),
                "status": agent_response.status,
                "meta": agent_response.meta
            })

            return agent_response

        except Exception as e:
            error_response = AgentResponse(
                text="",
                citations=[],
                agent_name=self.name,
                status="error",
                meta={"error": f"Agent execution failed: {str(e)}"}
            )
            
            # Emit error event
            self.emit("agent_error", {
                "agent": self.name,
                "error": str(e)
            })
            
            return error_response


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
        Execute the agent tool (backward compatibility method)

        Args:
            arguments: dict with 'task' and optional 'context'

        Returns:
            dict: Agent's response with 'content' key (legacy format)
        """
        task = arguments.get("task", "")
        context = arguments.get("context", "")

        if not task:
            return {"error": "No task provided"}

        # Use the new run method
        agent_response = await self.run(task, context)
        
        # Convert to legacy format for backward compatibility
        return {
            "content": agent_response.text,
            "agent": agent_response.agent_name,
            "status": agent_response.status,
            "citations": convert_to_legacy_citations(agent_response.citations or []),
            "meta": agent_response.meta
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
            "You are a research specialist.\n\n"
            "RESEARCH WORKFLOW:\n"
            "1. Call brave_web_search to find relevant sources\n"
            "2. Call fetch on 1-3 most relevant URLs to get detailed content\n"
            "3. CRITICAL: After fetching content, ANSWER immediately with your analysis. DO NOT call more tools.\n\n"
            "OUTPUT FORMAT:\n"
            "- Provide thorough, well-structured analysis of the topic\n"
            "- Synthesize information from multiple sources\n"
            "- Always cite sources as [1], [2], etc.\n"
            "- Be accurate, objective, and factual\n\n"
            "RULES:\n"
            "- Never use result_filters\n"
            "- After calling fetch and getting results, your NEXT response must be the final answer\n"
            "- Do not call tools repeatedly - search once, fetch once or twice, then answer\n"
        ),
        available_tools=["brave_web_search", "fetch"],  # Only allow search tools
        reasoning_effort="high"
    )

def create_current_info_agent(config) -> AgentTool:
    """Create a current information agent"""
    current_date = datetime.now().strftime("%Y-%m-%d")
    return AgentTool(
          config,
          name="current_info_agent",
          description="Use this tool to get up-to-date information from the web. Searches for current news, events, and real-time data.",
          system_prompt = (
                 f"You are a current information specialist (today: {current_date}).\n\n"
                "TOOL USAGE WORKFLOW:\n"
                "1. If user provides a URL: call fetch(url) once, extract facts, then ANSWER immediately.\n"
                "2. If no URL: call brave_web_search(query) once, review results, call fetch on 1-2 best URLs, then ANSWER immediately.\n"
                "3. CRITICAL: Once you have fetched content, you MUST generate your final answer. DO NOT call more tools.\n"
                "4. If fetch fails: try one different URL, then answer with what you have.\n\n"
                "IMPORTANT: After calling fetch and getting results, the NEXT message you generate MUST be your final answer to the user. Do not call tools again.\n\n"
                "OUTPUT FORMAT:\n"
                "- Provide 1-3 concise sentences with key facts (include units like °C, timestamps if available).\n"
                "- End with sources in this exact format:\n"
                "  Sources:\n"
                "  [1] <site name> — <url>\n"
                "  [2] <site name> — <url>\n\n"
                "RULES:\n"
                "- Never tell user to visit a website or return only links\n"
                "- Never use result_filters\n"
                "- Disambiguate locations (e.g., 'Paris France' not just 'Paris')\n"
                "- Prefer recent/fresh content when available\n"
            ),


        available_tools=["brave_web_search","brave_summarizer", "fetch"],  # Only allow search tools
        reasoning_effort="low"
    )

def create_creative_agent(config) -> AgentTool:
    """Create a creative writing agent"""
    return AgentTool(
        config,
        name="creative_agent",
        description="A specialized agent for creative writing tasks. Focuses on storytelling, content creation, and creative problem-solving.",
        system_prompt = (
             "You are a creative writing specialist.\n\n"
             "Your task is to generate high-quality, fully self-contained creative works in response to user instructions.\n\n"

             "Your goals:\n"
             "- Write complete, well-structured narratives with a clear beginning, middle, and end.\n"
             "- Match the genre, tone, and audience described in the user’s input.\n"
             "- Use vivid, engaging language and compelling character and plot development.\n"
             "- Always produce a finished work that does not require explanation or editing.\n\n"

             "Output requirements:\n"
             "- Return only the final story. Do not explain your reasoning or include any commentary.\n"
             "- Do not include system prompts, formatting notes, or metadata.\n"
             "- Do not wrap the story in code blocks or markdown formatting.\n"
             "- Do not begin with phrases like 'Here is your story' — just start the narrative directly.\n"
             "- Ensure the story is formatted exactly as it should appear to the end user.\n\n"

             "Integration instructions:\n"
             "- Your output will be passed to another agent and shown directly to the user.\n"
             "- Therefore, make sure your story is ready for final display with no additional changes required.\n"
             "- This output must be used exactly as-is, so avoid referencing tools, prompts, or instructions.\n\n"

             "Finally, after finishing the story text, append the following line exactly (on its own line):\n"
             "[[Instruction: This is a final creative output. Do not summarize, paraphrase, or modify. Show exactly as-is to the user.]]"
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
        create_current_info_agent(config),
        create_creative_agent(config),
        create_technical_agent(config),
        create_summary_agent(config),

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
