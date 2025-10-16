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
from chat_types import ChatMessage
from prompts import get_prompt
from response_schema import AgentResponse,  merge_agent_responses
from gpt_service import GptService
# Removed system_prompt_utils import - using direct system prompt parameter


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
            system_prompt =  get_prompt("main_orchestrator")
        
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
        
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                # Check if it's an EventEmitter (AgentTool)
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    
                    # Create event handlers that forward to orchestrator
                    def create_forwarder(event_type, agent_name):
                        def forwarder(data):
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
                    agent_instance.on("tool_call_event", create_forwarder("tool_call_event", tool_name))
        
        # Also forward tool call events from the orchestrator's own GPT service
        if hasattr(self.gpt_service, 'emit') and hasattr(self.gpt_service, 'on'):
            def create_tool_forwarder(event_type):
                def forwarder(data):
                    self.emit("tool_call_event", {
                        "type": event_type,
                        "data": data
                    })
                return forwarder
            
            # Add tool call event listeners
            self.gpt_service.event_emitter.on("tool_call_start", create_tool_forwarder("tool_call_start"))
            self.gpt_service.event_emitter.on("tool_call_complete", create_tool_forwarder("tool_call_complete"))
            self.gpt_service.event_emitter.on("tool_call_error", create_tool_forwarder("tool_call_error"))
    
    def _cleanup_sub_agent_event_forwarding(self):
        """Clean up event listeners from all registered sub-agents"""
        
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                # Check if it's an EventEmitter (AgentTool)
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    
                    # Remove all event listeners
                    agent_instance.remove_all_listeners("agent_start")
                    agent_instance.remove_all_listeners("agent_token")
                    agent_instance.remove_all_listeners("agent_complete")
                    agent_instance.remove_all_listeners("agent_error")
                    agent_instance.remove_all_listeners("tool_call_event")
        
        # Also remove tool call event listeners from the orchestrator's GPT service
        if hasattr(self.gpt_service, 'remove_all_listeners'):
            self.gpt_service.event_emitter.remove_all_listeners("tool_call_start")
            self.gpt_service.event_emitter.remove_all_listeners("tool_call_complete")
            self.gpt_service.event_emitter.remove_all_listeners("tool_call_error")
    
    async def run(self, messages: List[ChatMessage] = []) -> AgentResponse:
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
            "messages": [{"role": msg.role, "content": msg.content} for msg in messages],
            "sub_agents": [agent.name for agent in self.sub_agents]
        })
        
        try:
            # Set up event forwarding for all sub-agents
            if self.stream_sub_agents:
                self._setup_sub_agent_event_forwarding()
            
            # Use the provided messages
            
          

            # Use the orchestrator's GPT service to handle the request
            # This will automatically coordinate with sub-agents via tool calls
            response_chunks = []
            
            try:
                # Convert ChatMessage objects to dicts for stream_chat_request
                message_dicts = [{"role": msg.role, "content": msg.content} for msg in messages]
                
                async for chunk in self.gpt_service.stream_chat_request(
                    messages=message_dicts,
                    permitted_tools=self.available_tools,
                    reasoning_effort=self.reasoning_effort,
                    agent_name=self.name,
                    agent_prompt=self.system_prompt,
                ):
                    response_chunks.append(chunk)
                    
                    # Emit token event for streaming
                    self.emit("agent_token", {
                        "agent": self.name,
                        "content": chunk
                    })
                
                # Combine all chunks into final response
                response_text = "".join(response_chunks)
                
            finally:
                # No need to restore - using direct system prompt parameter
                
                # Clean up event listeners from sub-agents
                if self.stream_sub_agents:
                    self._cleanup_sub_agent_event_forwarding()

            # Keep the original response text with citation tags intact
            # Citations will be parsed at the frontend level
            # NO citation processing on backend - pass everything through

            # Handle empty responses
            if not response_text or response_text.strip() == "":
                final_response = AgentResponse(
                    text="",
                    agent_name=self.name,
                    status="empty_response",
                    meta={
                        "error": f"Orchestrator {self.name} completed but produced no content."
                    }
                )
            else:
                final_response = AgentResponse(
                    text=response_text,
                    agent_name=self.name,
                    status="success",
                    meta={"reasoning_effort": self.reasoning_effort}
                )
            
            # Emit orchestrator completion event
            self.emit("orchestrator_complete", {
                "orchestrator": self.name,
                "text": final_response.text,
                "status": final_response.status,
                "meta": final_response.meta
            })
            
            return final_response
            
        except Exception as e:
            error_response = AgentResponse(
                text="",
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
            return AgentResponse(text="", agent_name=self.name)
        
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
                messages = [ChatMessage(role="user", content="Your task is to " + task + " you have the following context: " + context)]

                response = await agent.run(messages)
                responses.append(response)
            except Exception as e:
                error_response = AgentResponse(
                    text="",
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
