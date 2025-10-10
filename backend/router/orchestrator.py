"""
Orchestrator - Coordinates multiple sub-agents and synthesizes their responses

The Orchestrator is a specialized Agent that:
1. Coordinates sub-agents to handle complex tasks
2. Streams events from both orchestrator and sub-agents
3. Merges responses from multiple agents
4. Provides a unified interface for the main system
"""

from typing import List, Dict, Any, Optional
from agent_tool import AgentTool
from response_schema import AgentResponse, merge_agent_responses, convert_to_legacy_citations
from gpt_service import GptService


class Orchestrator(AgentTool):
    """
    Orchestrator that coordinates sub-agents and synthesizes their responses
    
    The Orchestrator extends AgentTool to maintain the same interface while
    adding coordination capabilities for sub-agents.
    """
    
    def __init__(
        self,
        model_config: Dict[str, Any],
        name: str = "orchestrator",
        description: str = "Main orchestrator that coordinates sub-agents",
        system_prompt: Optional[str] = None,
        available_tools: Optional[List[str]] = None,
        reasoning_effort: str = "high",
        stream_sub_agents: bool = True,
        sub_agents: Optional[List[AgentTool]] = None
    ):
        """
        Initialize the orchestrator
        
        Args:
            model_config: Model configuration
            name: Name of the orchestrator
            description: Description of what the orchestrator does
            system_prompt: System prompt for the orchestrator
            available_tools: Tools available to the orchestrator
            reasoning_effort: Reasoning effort level
            stream_sub_agents: Whether to stream sub-agent events
            sub_agents: List of sub-agents to coordinate
        """
        # Default orchestrator system prompt
        if system_prompt is None:
            system_prompt = (
                "You are the main orchestrator for Geist AI.\n\n"
                "CRITICAL: You MUST use tools when users ask for current information, research, or facts you don't know.\n\n"
                "Your role is to:\n"
                "- Analyze user requests and determine the best approach\n"
                "- ALWAYS use appropriate tools for current information, research, or specialized tasks\n"
                "- Coordinate with specialized sub-agents when needed\n"
                "- Synthesize information from multiple sources\n"
                "- Provide comprehensive, well-structured responses\n"
                "- Always cite sources when using information from agents or web searches\n\n"
                "MANDATORY TOOL USAGE:\n"
                "- For current events, sports scores, weather, news: Call current_info_agent with the user's question as the 'task' parameter\n"
                "- For research, fact-finding, web searches: Call research_agent with the user's question as the 'task' parameter\n"
                "- For creative writing, stories: Call creative_agent with the user's question as the 'task' parameter\n"
                "- For technical analysis, coding: Call technical_agent with the user's question as the 'task' parameter\n"
                "- For summarization: Call summary_agent with the user's question as the 'task' parameter\n\n"
                "CRITICAL: When you need current information, you MUST call the appropriate tool function immediately.\n"
                "NEVER say 'I'll check' or 'Let me look that up' without actually calling the tool.\n"
                "ALWAYS call the tool function with the user's exact question as the 'task' parameter.\n\n"
                "Always provide clear, accurate, and well-cited responses."
            )
        
        super().__init__(
            model_config=model_config,
            name=name,
            description=description,
            system_prompt=system_prompt,
            available_tools=available_tools or [],
            reasoning_effort=reasoning_effort,
            stream_sub_agents=stream_sub_agents
        )
        
        self.sub_agents: List[AgentTool] = sub_agents or []
    
    def add_sub_agent(self, agent: AgentTool):
        """Add a sub-agent to the orchestrator"""
        self.sub_agents.append(agent)
        
        # Set up event forwarding if streaming is enabled
        if self.stream_sub_agents:
            agent.on("agent_start", self._forward_agent_event)
            agent.on("agent_token", self._forward_agent_event)
            agent.on("agent_complete", self._forward_agent_event)
            agent.on("agent_error", self._forward_agent_event)
    
    def _forward_agent_event(self, event_data: dict):
        """Forward sub-agent events to orchestrator listeners"""
        if self.stream_sub_agents:
            self.emit("sub_agent_event", event_data)
    
    def _setup_sub_agent_event_forwarding(self):
        """Set up event forwarding for all registered sub-agents"""
        print(f"🎯 Setting up event forwarding for {len(self.gpt_service._tool_registry)} tools")
        
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                # Check if it's an EventEmitter (AgentTool)
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    print(f"🎯 Setting up event forwarding for sub-agent: {tool_name}")
                    
                    # Create event handlers that forward to orchestrator
                    def create_forwarder(event_type, agent_name):
                        def forwarder(data):
                            print(f"🎯 Forwarding {event_type} from {agent_name}")
                            self.emit("sub_agent_event", {
                                "type": event_type,
                                "agent": agent_name,
                                "data": data
                            })
                        return forwarder
                    
                    # Add event listeners
                    agent_instance.on("agent_start", create_forwarder("agent_start", tool_name))
                    agent_instance.on("agent_token", create_forwarder("agent_token", tool_name))
                    agent_instance.on("agent_complete", create_forwarder("agent_complete", tool_name))
                    agent_instance.on("agent_error", create_forwarder("agent_error", tool_name))
    
    def _cleanup_sub_agent_event_forwarding(self):
        """Clean up event listeners from all registered sub-agents"""
        print(f"🎯 Cleaning up event forwarding for {len(self.gpt_service._tool_registry)} tools")
        
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                # Check if it's an EventEmitter (AgentTool)
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    print(f"🎯 Cleaning up event listeners for sub-agent: {tool_name}")
                    
                    # Remove all event listeners
                    agent_instance.remove_all_listeners("agent_start")
                    agent_instance.remove_all_listeners("agent_token")
                    agent_instance.remove_all_listeners("agent_complete")
                    agent_instance.remove_all_listeners("agent_error")
    
    async def run(self, input_data: str, context: str = "") -> AgentResponse:
        """
        Run the orchestrator with sub-agent coordination
        
        Args:
            input_data: The task or question
            context: Additional context
            
        Returns:
            AgentResponse with synthesized results
        """
        # Emit orchestrator start event
        self.emit("orchestrator_start", {
            "orchestrator": self.name,
            "input": input_data,
            "context": context,
            "sub_agents": [agent.name for agent in self.sub_agents]
        })
        
        try:
            # Set up event forwarding for all sub-agents
            if self.stream_sub_agents:
                self._setup_sub_agent_event_forwarding()
            
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

            # Use the orchestrator's GPT service to handle the request
            # This will automatically coordinate with sub-agents via tool calls
            response_chunks = []
            citations = []
            
            # Override system prompt for orchestrator
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
            
            print(f"🎯 Orchestrator starting with {len(self.available_tools)} available tools")
            print(f"🎯 Available tools: {self.available_tools}")
            
            try:
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
                print(f"🎯 Orchestrator completed with {len(response_chunks)} chunks")
                
            finally:
                # Restore original methods
                self.gpt_service.prepare_conversation_messages = original_prepare
                
                # Clean up event listeners from sub-agents
                if self.stream_sub_agents:
                    self._cleanup_sub_agent_event_forwarding()

            # Convert legacy citations to new format
            from response_schema import convert_legacy_citations
            structured_citations = convert_legacy_citations(citations)

            # Handle empty responses
            if not response_text or response_text.strip() == "":
                final_response = AgentResponse(
                    text="",
                    citations=structured_citations,
                    agent_name=self.name,
                    status="empty_response",
                    meta={
                        "error": f"Orchestrator {self.name} completed but produced no content."
                    }
                )
            else:
                final_response = AgentResponse(
                    text=response_text,
                    citations=structured_citations,
                    agent_name=self.name,
                    status="success",
                    meta={"reasoning_effort": self.reasoning_effort}
                )
            
            # Emit orchestrator completion event
            self.emit("orchestrator_complete", {
                "orchestrator": self.name,
                "text": final_response.text,
                "citations": convert_to_legacy_citations(final_response.citations or []),
                "status": final_response.status,
                "meta": final_response.meta
            })
            
            return final_response
            
        except Exception as e:
            error_response = AgentResponse(
                text="",
                citations=[],
                agent_name=self.name,
                status="error",
                meta={"error": f"Orchestrator execution failed: {str(e)}"}
            )
            
            # Emit error event
            self.emit("orchestrator_error", {
                "orchestrator": self.name,
                "error": str(e)
            })
            
            return error_response
    
    async def synthesize_responses(self, responses: List[AgentResponse]) -> AgentResponse:
        """
        Synthesize multiple agent responses into a single response
        
        Args:
            responses: List of agent responses to synthesize
            
        Returns:
            Synthesized AgentResponse
        """
        if not responses:
            return AgentResponse(text="", citations=[], agent_name=self.name)
        
        # Use the merge logic from response_schema
        merged_response = merge_agent_responses(responses)
        
        # Set the orchestrator as the agent name
        merged_response.agent_name = self.name
        
        return merged_response
    
    async def coordinate_sub_agents(self, task: str, context: str = "") -> List[AgentResponse]:
        """
        Coordinate multiple sub-agents to handle a complex task
        
        Args:
            task: The task to distribute among sub-agents
            context: Additional context
            
        Returns:
            List of responses from sub-agents
        """
        responses = []
        
        # For now, this is a placeholder for more sophisticated coordination logic
        # In a full implementation, you might:
        # 1. Analyze the task to determine which agents are needed
        # 2. Split the task into subtasks
        # 3. Run agents in parallel or sequence as appropriate
        # 4. Handle dependencies between agents
        
        for agent in self.sub_agents:
            try:
                response = await agent.run(task, context)
                responses.append(response)
            except Exception as e:
                error_response = AgentResponse(
                    text="",
                    citations=[],
                    agent_name=agent.name,
                    status="error",
                    meta={"error": f"Sub-agent {agent.name} failed: {str(e)}"}
                )
                responses.append(error_response)
        
        return responses


def create_orchestrator(
    config,
    sub_agents: Optional[List[AgentTool]] = None,
    stream_sub_agents: bool = True,
    available_tools: Optional[List[str]] = None
) -> Orchestrator:
    """
    Create a configured orchestrator with sub-agents
    
    Args:
        config: Configuration object
        sub_agents: List of sub-agents to coordinate
        stream_sub_agents: Whether to stream sub-agent events
        
    Returns:
        Configured Orchestrator instance
    """
    orchestrator = Orchestrator(
        model_config=config,
        stream_sub_agents=stream_sub_agents,
        sub_agents=sub_agents or [],
        available_tools=available_tools or []
    )
    
    return orchestrator
