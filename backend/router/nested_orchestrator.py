"""
Enhanced Orchestrator with full nested sub-agent support

This extends the base Orchestrator to support arbitrary levels of nesting
with proper event forwarding and context tracking.
"""

from typing import List, Dict, Any, Optional, Set
from orchestrator import Orchestrator
from agent_tool import AgentTool
from response_schema import AgentResponse,  merge_agent_responses


class NestedOrchestrator(Orchestrator):
    """
    Enhanced Orchestrator that supports nested sub-agents with full event forwarding
    
    Features:
    - Arbitrary nesting depth
    - Event path tracking (e.g., "main.research.web_search")
    - Recursive event forwarding
    - Context preservation through nesting levels
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._event_paths: Dict[str, str] = {}  # Maps agent names to their full paths
        self._setup_recursive_event_forwarding()
    
    def _setup_recursive_event_forwarding(self):
        """Set up event forwarding for all agents, including nested ones"""
        print(f"🎯 Setting up recursive event forwarding for {len(self.gpt_service._tool_registry)} tools")
        
        # First pass: identify all agents and their immediate paths
        self._discover_agent_hierarchy()
        
        # Second pass: set up forwarding with full paths
        self._setup_nested_event_forwarding()
    
    def _discover_agent_hierarchy(self):
        """Discover the full hierarchy of agents and their paths"""
        # Start with direct tools
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    # This is a direct sub-agent
                    self._event_paths[tool_name] = f"{self.name}.{tool_name}"
                    
                    # Check if this agent has its own sub-agents
                    if hasattr(agent_instance, 'gpt_service') and hasattr(agent_instance.gpt_service, '_tool_registry'):
                        self._discover_nested_agents(agent_instance, f"{self.name}.{tool_name}")
    
    def _discover_nested_agents(self, parent_agent, parent_path: str):
        """Recursively discover nested agents"""
        if not hasattr(parent_agent, 'gpt_service') or not hasattr(parent_agent.gpt_service, '_tool_registry'):
            return
            
        for tool_name, tool_info in parent_agent.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    # This is a nested sub-agent
                    full_path = f"{parent_path}.{tool_name}"
                    self._event_paths[tool_name] = full_path
                    print(f"🎯 Discovered nested agent: {tool_name} at path {full_path}")
                    
                    # Recursively discover deeper nesting
                    self._discover_nested_agents(agent_instance, full_path)
    
    def _setup_nested_event_forwarding(self):
        """Set up event forwarding with full path context"""
        for tool_name, tool_info in self.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                agent_instance = executor.__self__
                if hasattr(agent_instance, 'emit') and hasattr(agent_instance, 'on'):
                    print(f"🎯 Setting up nested event forwarding for: {tool_name}")
                    
                    # Create event handlers with full path context
                    def create_nested_forwarder(event_type, agent_name, full_path):
                        def forwarder(data):
                            print(f"🎯 Forwarding {event_type} from {agent_name} (path: {full_path})")
                            self.emit("sub_agent_event", {
                                "type": event_type,
                                "agent": agent_name,
                                "path": full_path,
                                "level": full_path.count('.'),
                                "data": data
                            })
                        return forwarder
                    
                    full_path = self._event_paths.get(tool_name, f"{self.name}.{tool_name}")
                    
                    # Add event listeners with path context
                    agent_instance.on("agent_start", create_nested_forwarder("agent_start", tool_name, full_path))
                    agent_instance.on("agent_token", create_nested_forwarder("agent_token", tool_name, full_path))
                    agent_instance.on("agent_complete", create_nested_forwarder("agent_complete", tool_name, full_path))
                    agent_instance.on("agent_error", create_nested_forwarder("agent_error", tool_name, full_path))
                    
                    # If this agent has its own sub-agents, set up recursive forwarding
                    if hasattr(agent_instance, 'gpt_service') and hasattr(agent_instance.gpt_service, '_tool_registry'):
                        self._setup_recursive_forwarding_for_agent(agent_instance, full_path)
    
    def _setup_recursive_forwarding_for_agent(self, agent_instance, parent_path: str):
        """Set up recursive event forwarding for a specific agent's sub-agents"""
        for tool_name, tool_info in agent_instance.gpt_service._tool_registry.items():
            executor = tool_info.get('executor')
            if executor and hasattr(executor, '__self__'):
                sub_agent_instance = executor.__self__
                if hasattr(sub_agent_instance, 'emit') and hasattr(sub_agent_instance, 'on'):
                    full_path = f"{parent_path}.{tool_name}"
                    
                    # Create a forwarder that bubbles up to the main orchestrator
                    def create_recursive_forwarder(event_type, agent_name, path):
                        def forwarder(data):
                            print(f"🎯 Recursive forwarding {event_type} from {agent_name} (path: {path})")
                            # Forward to the main orchestrator
                            self.emit("sub_agent_event", {
                                "type": event_type,
                                "agent": agent_name,
                                "path": path,
                                "level": path.count('.'),
                                "data": data
                            })
                        return forwarder
                    
                    # Add listeners to the nested agent
                    sub_agent_instance.on("agent_start", create_recursive_forwarder("agent_start", tool_name, full_path))
                    sub_agent_instance.on("agent_token", create_recursive_forwarder("agent_token", tool_name, full_path))
                    sub_agent_instance.on("agent_complete", create_recursive_forwarder("agent_complete", tool_name, full_path))
                    sub_agent_instance.on("agent_error", create_recursive_forwarder("agent_error", tool_name, full_path))
                    
                    # Recursively set up for deeper nesting
                    self._setup_recursive_forwarding_for_agent(sub_agent_instance, full_path)
    
    def get_agent_hierarchy(self) -> Dict[str, str]:
        """Get the full hierarchy of agents and their paths"""
        return self._event_paths.copy()
    
    def get_agents_by_level(self, level: int) -> List[str]:
        """Get all agents at a specific nesting level"""
        return [agent for agent, path in self._event_paths.items() if path.count('.') == level]


# Example usage and factory functions
def create_nested_orchestrator(
    config,
    sub_agents: Optional[List[AgentTool]] = None,
    stream_sub_agents: bool = True,
    available_tools: Optional[List[str]] = None
) -> NestedOrchestrator:
    """
    Create a nested orchestrator with full hierarchy support
    
    Example usage:
    ```python
    # Create a research orchestrator with web search sub-agents
    research_orchestrator = NestedOrchestrator(
        model_config=config,
        name="research_orchestrator",
        sub_agents=[
            web_search_agent,  # This could have its own sub-agents
            data_analysis_agent
        ]
    )
    
    # Create main orchestrator that uses research orchestrator
    main_orchestrator = NestedOrchestrator(
        model_config=config,
        name="main_orchestrator", 
        sub_agents=[research_orchestrator, creative_agent]
    )
    ```
    """
    orchestrator = NestedOrchestrator(
        model_config=config,
        stream_sub_agents=stream_sub_agents,
        sub_agents=sub_agents or [],
        available_tools=available_tools or []
    )
    
    return orchestrator


# Example of how to create a deeply nested structure
