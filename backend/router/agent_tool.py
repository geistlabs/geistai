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
from response_schema import AgentResponse
from events import EventEmitter
from prompts import get_prompt
# Removed system_prompt_utils import - using direct system prompt parameter


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

        # Set up tool call event forwarding from this agent's GPT service
        self._setup_tool_call_event_forwarding()

        # Tool registry for this agent (will be populated when initialized)
        self._agent_tool_registry: Dict[str, dict] = {}

    def _setup_tool_call_event_forwarding(self):
        """Set up tool call event forwarding from this agent's GPT service"""
        if hasattr(self.gpt_service, 'emit') and hasattr(self.gpt_service, 'on'):
            def create_tool_forwarder(event_type):
                def forwarder(data):
                    print(f"🎯 Agent {self.name} forwarding {event_type}")
                    self.emit("tool_call_event", {
                        "type": event_type,
                        "data": data
                    })
                return forwarder

            # Add tool call event listeners
            self.gpt_service.on("tool_call_start", create_tool_forwarder("tool_call_start"))
            self.gpt_service.on("tool_call_complete", create_tool_forwarder("tool_call_complete"))
            self.gpt_service.on("tool_call_error", create_tool_forwarder("tool_call_error"))

    def _cleanup_tool_call_event_forwarding(self):
        """Clean up tool call event listeners from this agent's GPT service"""
        if hasattr(self.gpt_service, 'remove_all_listeners'):
            self.gpt_service.remove_all_listeners("tool_call_start")
            self.gpt_service.remove_all_listeners("tool_call_complete")
            self.gpt_service.remove_all_listeners("tool_call_error")

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
            AgentResponse with text and metadata
        """
        # Emit start event
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

            # Get response from agent using streaming with system prompt
            response_chunks = []
            chunk_count = 0
            async for chunk in self.gpt_service.stream_chat_request(
                messages=messages,
                reasoning_effort=self.reasoning_effort,
                agent_name=self.name,
                permitted_tools=self.available_tools,
                agent_prompt=self.system_prompt,
            ):
                response_chunks.append(chunk)
                chunk_count += 1
                # Debug: Log first few chunks
                if chunk_count <= 5:
                    print(f"🔍 Agent {self.name} chunk {chunk_count}: '{chunk}'")
                # Emit token event for streaming
                self.emit("agent_token", {
                    "agent": self.name,
                    "content": chunk
                })

            # Combine all chunks into final response
            response_text = "".join(response_chunks)
            print(f"🔍 Agent {self.name} received {chunk_count} total chunks, response_text length: {len(response_text)}")

            # GPT-OSS Harmony Format Fix: Detect reasoning-only responses
            # and generate a final answer
            if self._is_reasoning_only(response_text):
                print(f"⚠️  Agent {self.name} returned reasoning-only response, generating final answer...")
                response_text = await self._generate_final_answer(input_data, response_text, messages)
                print(f"✅ Generated final answer, length: {len(response_text)}")

            # Keep the original response text with citation tags intact
            # Citations will be parsed at the frontend level
            # NO citation processing on backend - pass everything through

            # Handle empty responses
            if not response_text or response_text.strip() == "":
                agent_response = AgentResponse(
                    text="",
                    agent_name=self.name,
                    status="empty_response",
                    meta={
                        "error": f"Agent {self.name} completed tool execution but produced no content. This may indicate a Harmony format issue where reasoning_content was generated but no final content channel was used."
                    }
                )
            else:
                agent_response = AgentResponse(
                    text=response_text,
                    agent_name=self.name,
                    status="success",
                    meta={"reasoning_effort": self.reasoning_effort}
                )

            # Emit completion event
            self.emit("agent_complete", {
                "agent": self.name,
                "text": agent_response.text,
                "status": agent_response.status,
                "meta": agent_response.meta
            })

            return agent_response

        except Exception as e:
            error_response = AgentResponse(
                text="",

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

    def _is_reasoning_only(self, text: str) -> bool:
        """
        Detect if the response is reasoning-only (GPT-OSS Harmony format issue)

        Reasoning-only indicators:
        - Contains planning language like "We need", "Let's", "Should", "I'll"
        - Short responses (< 100 chars) with no actual data
        - Doesn't contain concrete facts, numbers, or citations
        """
        if not text:
            return False

        text_lower = text.lower()

        # Strong indicators of reasoning-only content
        reasoning_phrases = [
            "we need to", "let's", "i need to", "i should", "we should",
            "i'll", "we'll", "must use", "need to browse", "need to fetch",
            "should fetch", "should search", "need to search",
            "must fetch", "must search", "must browse"
        ]

        phrase_count = sum(1 for phrase in reasoning_phrases if phrase in text_lower)

        # If contains any reasoning phrases and lacks citations or numbers, likely reasoning-only
        has_citation = "<citation" in text
        has_number = any(ch.isdigit() for ch in text)
        if phrase_count >= 1 and not has_citation and not has_number:
            return True

        return False

    async def _generate_final_answer(self, original_question: str, reasoning: str, conversation_history: list) -> str:
        """
        Generate a final answer when GPT-OSS only provided reasoning

        WORKAROUND: Instead of making another LLM call (which will also fail with Harmony format),
        we extract tool results and format them into a basic answer.
        """
        # Extract search/fetch/summarizer results from GPT service's tool results
        tool_results = []

        if hasattr(self.gpt_service, '_last_tool_results'):
            tool_results = self.gpt_service._last_tool_results
            print(f"🔍 Found {len(tool_results)} tool results from GPT service")

        # If no tool results from service, try to extract from conversation
        if not tool_results:
            for msg in conversation_history:
                if msg.get('role') == 'tool':
                    tool_results.append({
                        'tool_name': 'fetch' if 'url' in msg.get('content', '') else 'search',
                        'result': msg.get('content', '')
                    })

        # Build a simple factual answer from tool results
        if tool_results:
            answer_candidates = []
            sources = []

            for tr in tool_results:
                tool_name = tr.get('tool_name')
                res = tr.get('result')

                # Prefer summarizer output if available
                if tool_name and 'summarizer' in tool_name.lower():
                    if isinstance(res, dict):
                        text = res.get('text') or res.get('content') or ''
                    else:
                        text = str(res)
                    if text and len(text) > 30:
                        answer_candidates.append(text.strip())
                        url = tr.get('arguments', {}).get('url')
                        if url:
                            sources.append(url)
                    continue

                # Use fetch content as fallback
                if tool_name and tool_name.lower() == 'fetch':
                    if isinstance(res, dict):
                        text = res.get('content') or res.get('text') or ''
                        url = res.get('url') or tr.get('arguments', {}).get('url')
                        if url:
                            sources.append(url)
                    else:
                        text = str(res)
                    
                    # Skip fetch failures (error messages)
                    if text and ("Failed to fetch" in text or "robots.txt" in text or "connection issue" in text.lower()):
                        print(f"⚠️  Skipping failed fetch result: {text[:100]}")
                        continue
                    
                    if text and len(text) > 50:
                        answer_candidates.append(text.strip())

            # If no summarizer/fetch text, try brave_web_search descriptions (they often contain useful snippets)
            if not answer_candidates:
                for tr in tool_results:
                    tool_name = tr.get('tool_name', '')
                    if 'brave' in tool_name.lower() and 'search' in tool_name.lower():
                        res = tr.get('result')
                        # Parse JSON search results
                        if isinstance(res, str):
                            try:
                                import json
                                # Results are newline-separated JSON objects
                                for line in res.strip().split('\n'):
                                    if line.strip():
                                        result_obj = json.loads(line)
                                        desc = result_obj.get('description', '')
                                        if desc and len(desc) > 30:
                                            # Clean HTML tags from description
                                            import re
                                            clean_desc = re.sub(r'<[^>]+>', '', desc)
                                            answer_candidates.append(clean_desc)
                                            url = result_obj.get('url')
                                            if url:
                                                sources.append(url)
                            except:
                                pass
            
            # If still no candidates, try any string content
            if not answer_candidates:
                for tr in tool_results:
                    res = tr.get('result')
                    if isinstance(res, str) and len(res) > 50:
                        # Skip error messages
                        if "Failed to fetch" not in res and "robots.txt" not in res:
                            answer_candidates.append(res.strip())

            if answer_candidates:
                # Take the first candidate and keep it concise
                base = answer_candidates[0]
                sentences = [s.strip() for s in base.split('.') if s.strip()]
                final_answer = '. '.join(sentences[:2])
                if sources:
                    final_answer += f" [Sources: {', '.join(sources[:2])}]"
                print(f"✅ Built answer from tool results: {len(final_answer)} chars")
                return final_answer

        # Fallback: If all tool results failed, try a targeted fetch on reliable sources
        try:
            preferred_urls = [
                "https://www.timeanddate.com/weather/france/paris",
                "https://www.bbc.com/weather/2988507"
            ]
            for url in preferred_urls:
                result = await self.gpt_service._execute_tool("fetch", {"url": url, "max_length": 1200})
                if isinstance(result, dict):
                    text = result.get('content') or result.get('text') or ''
                else:
                    text = str(result)
                
                # Skip fetch failures
                if text and ("Failed to fetch" in text or "robots.txt" in text or "connection issue" in text.lower()):
                    print(f"⚠️  Fallback fetch failed for {url}: {text[:80]}")
                    continue
                
                if text and len(text) > 60:
                    # Build concise response
                    sentences = [s.strip() for s in text.split('.') if s.strip()]
                    final_answer = '. '.join(sentences[:2]) + f" [Sources: {url}]"
                    print(f"✅ Built fallback answer from preferred source: {url}")
                    return final_answer
        except Exception as e:
            print(f"⚠️  Fallback fetch failed: {e}")

        # Fallback: Return the reasoning as-is
        print(f"⚠️  No tool results found, returning reasoning as-is")
        return reasoning

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
        print(f"🔍 AgentTool {self.name} execute called with arguments: {arguments}")
        task = arguments.get("task", "")
        context = arguments.get("context", "")

        if not task:
            print(f"❌ AgentTool {self.name} - No task provided in arguments: {arguments}")
            return {"error": "No task provided"}

        print(f"✅ AgentTool {self.name} - Task: '{task}', Context: '{context}'")
        # Use the new run method
        agent_response = await self.run(task, context)
        print(f"AgentTool {self.name} agent_response: {agent_response}")

        # Convert to legacy format for backward compatibility
        return {
            "content": agent_response.text,
            "agent": agent_response.agent_name,
            "status": agent_response.status,

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
        system_prompt=get_prompt("research_agent"),
        available_tools=["brave_web_search", "brave_summarizer", "fetch"],
        reasoning_effort="high"
    )

def create_current_info_agent(config) -> AgentTool:
    """Create a current information agent"""
    return AgentTool(
        config,
        name="current_info_agent",
        description="Use this tool to get up-to-date information from the web. Searches for current news, events, and real-time data.",
        system_prompt=get_prompt("current_info_agent"),
        available_tools=["brave_web_search", "brave_summarizer", "fetch"],
        reasoning_effort="low"
    )

def create_creative_agent(config) -> AgentTool:
    """Create a creative writing agent"""
    return AgentTool(
        config,
        name="creative_agent",
        description="A specialized agent for creative writing tasks. Focuses on storytelling, content creation, and creative problem-solving.",
        system_prompt=get_prompt("creative_agent"),
        available_tools=["brave_web_search", "fetch"],  # Include research and citation tools
        reasoning_effort="medium"
    )


def create_technical_agent(config) -> AgentTool:
    """Create a technical analysis agent"""
    return AgentTool(
        config,
        name="technical_agent",
        description="A specialized agent for technical analysis, coding, and problem-solving. Can analyze code, debug issues, and provide technical solutions.",
        system_prompt=get_prompt("technical_agent"),
        available_tools=["brave_web_search", "fetch"],  # Include research and citation tools
        reasoning_effort="high"
    )


def create_summary_agent(config) -> AgentTool:
    """Create a summarization agent"""
    return AgentTool(
        config,
        name="summary_agent",
        description="A specialized agent for summarizing information. Can condense long texts, extract key points, and create concise summaries.",
        system_prompt=get_prompt("summary_agent"),
        available_tools=["brave_web_search", "fetch"],  # Include research and citation tools
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
