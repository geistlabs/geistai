# Agent System Documentation

This document explains how to use the configurable agent system that allows you to create specialized sub-agents as tools for your main GPT service.

## 🎯 **What Are Agent Tools?**

Agent tools are specialized AI assistants that can be called by your main GPT service. Each agent has:

- **Custom system prompt** - Defines the agent's role and behavior
- **Configurable tools** - Can use specific tools from your main service
- **Reasoning level** - Controls how deeply the agent thinks
- **Model configuration** - Can override model settings
- **Streaming support** - Uses streaming for tool calling capabilities

## 🚀 **Quick Start**

### 1. **Add Predefined Agents**

Uncomment this line in `gpt_service.py` → `_register_custom_tools()`:

```python
# Register all predefined agents
from agent_registry import register_predefined_agents
await register_predefined_agents(self, config)
```

### 2. **Add to Permitted Tools**

Add agent names to `PERMITTED_TOOLS` in `gpt_service.py`:

```python
PERMITTED_TOOLS = [
    "research_agent",    # Agent tool
    "creative_agent",    # Agent tool
    "technical_agent",   # Agent tool
    "summary_agent",     # Agent tool
    "brave_web_search",  # MCP tool (if available)
]
```

### 3. **Use the Agents**

Your main LLM can now delegate tasks to specialized agents:

```
User: "Research the latest developments in AI and write a creative story about it"

LLM: I'll use the research agent to gather information, then the creative agent to write the story.

[Uses research_agent tool with streaming and tool calling]
[Uses creative_agent tool with streaming]
```

## 🛠️ **Predefined Agents**

### **Research Agent**
- **Purpose**: Conducts thorough research using web search
- **Tools**: `brave_web_search`
- **Best for**: Fact-finding, current events, detailed analysis

### **Creative Agent**
- **Purpose**: Creative writing and storytelling
- **Tools**: None (pure creativity)
- **Best for**: Stories, content creation, creative problem-solving

### **Technical Agent**
- **Purpose**: Technical analysis and problem-solving
- **Tools**: None (could add code analysis tools)
- **Best for**: Debugging, technical explanations, code review

### **Summary Agent**
- **Purpose**: Summarizing and condensing information
- **Tools**: None
- **Best for**: Creating summaries, extracting key points

## 🎨 **Creating Custom Agents**

### **Method 1: Using the Registry**

```python
# In _register_custom_tools()
from agent_registry import register_custom_agent

await register_custom_agent(
    gpt_service=self,
    config=config,  # Pass actual config object
    name="math_tutor",
    description="A specialized agent for math tutoring and problem-solving",
    system_prompt=(
        "You are a math tutor. Your role is to:\n"
        "- Help students understand mathematical concepts\n"
        "- Solve math problems step by step\n"
        "- Explain the reasoning behind solutions\n"
        "- Provide practice problems and examples\n"
        "- Be patient and encouraging\n\n"
        "Always show your work and explain each step clearly."
    ),
    available_tools=[],  # Could add calculator tool here
    reasoning_effort="high"
)
```

### **Method 2: Direct Creation**

```python
# In _register_custom_tools()
from agent_tool import AgentTool

# Create the agent
math_agent = AgentTool(
    name="math_tutor",
    description="A specialized agent for math tutoring and problem-solving",
    system_prompt=(
        "You are a math tutor. Your role is to:\n"
        "- Help students understand mathematical concepts\n"
        "- Solve math problems step by step\n"
        "- Explain the reasoning behind solutions\n"
        "- Provide practice problems and examples\n"
        "- Be patient and encouraging\n\n"
        "Always show your work and explain each step clearly."
    ),
    available_tools=[],  # Could add calculator tool here
    reasoning_effort="high"
)

# Initialize and register
await math_agent.initialize(self, config)
self._register_tool(
    name=math_agent.name,
    description=math_agent.description,
    input_schema=math_agent.get_tool_definition()["function"]["parameters"],
    executor=math_agent.execute,
    tool_type="agent"
)
```

## ⚙️ **Configuration Options**

### **System Prompt**
Define the agent's role, behavior, and expertise:

```python
system_prompt=(
    "You are a [ROLE]. Your role is to:\n"
    "- [Specific task 1]\n"
    "- [Specific task 2]\n"
    "- [Specific task 3]\n\n"
    "Be [behavioral guidelines] in your approach."
)
```

### **Available Tools**
Control which tools the agent can use:

```python
available_tools=["brave_web_search", "calculator"]  # Specific tools
available_tools=[]  # No external tools
available_tools=None  # All tools from main service
```

### **Reasoning Effort**
Control how deeply the agent thinks:

```python
reasoning_effort="low"    # Quick responses
reasoning_effort="medium" # Balanced thinking
reasoning_effort="high"   # Deep analysis
```

### **Model Configuration**
Override model settings for the agent:

```python
model_config={
    "temperature": 0.3,  # More focused
    "max_tokens": 1000,  # Longer responses
    "model": "gpt-4"     # Different model
}
```

## 🔄 **How It Works**

1. **Main LLM** receives a user request
2. **Main LLM** decides to delegate to an agent
3. **Agent** receives the task with its custom system prompt
4. **Agent** uses streaming with tool calling capabilities
5. **Agent** can use its configured tools (like web search for research agent)
6. **Agent** streams response back to main LLM
7. **Main LLM** incorporates agent response into final answer

### **Streaming & Tool Calling**
- Agents use `stream_chat_request()` instead of `process_chat_request()`
- This enables tool calling within agent execution
- Research agent can actually use `brave_web_search` to find information
- All agents can use their configured tools during execution

### **Reasoning Display**
- Agents print their reasoning process in real-time
- Content is streamed and displayed as it's generated
- Tool execution results are visible during agent operation
- Provides transparency into agent decision-making

## 📝 **Example Use Cases**

### **Research + Creative Writing**
```
User: "Write a creative story about space exploration"

Main LLM: I'll research current space exploration developments, then create a story.

[Uses research_agent with task: "Find latest space exploration news"]
  → Research agent uses brave_web_search tool to find current information
  → Streams research results back
[Uses creative_agent with task: "Write a creative story based on: [research results]"]
  → Creative agent streams creative story back
```

### **Technical Analysis + Summary**
```
User: "Analyze this code and give me a summary"

Main LLM: I'll have the technical agent analyze the code, then summarize the findings.

[Uses technical_agent with task: "Analyze this code: [code]"]
  → Technical agent streams detailed analysis
[Uses summary_agent with task: "Summarize: [technical analysis]"]
  → Summary agent streams condensed summary
```

### **Multi-Step Problem Solving**
```
User: "Help me understand quantum computing"

Main LLM: I'll research the basics, then have the technical agent explain the concepts.

[Uses research_agent with task: "Research quantum computing basics"]
  → Research agent uses web search to find current information
  → Streams research findings
[Uses technical_agent with task: "Explain quantum computing concepts based on: [research]"]
  → Technical agent streams detailed explanation
```

## 🎯 **Best Practices**

### **Agent Design**
- **Single Responsibility**: Each agent should have a clear, focused purpose
- **Clear Prompts**: Write specific, actionable system prompts
- **Appropriate Tools**: Only give agents tools they actually need
- **Reasoning Level**: Match reasoning effort to task complexity

### **Tool Selection**
- **Research tasks**: Include web search tools
- **Creative tasks**: No external tools needed
- **Technical tasks**: Consider code analysis tools
- **Summary tasks**: No external tools needed

### **System Prompts**
- **Be specific** about the agent's role
- **List key responsibilities** clearly
- **Include behavioral guidelines**
- **Set expectations** for output format

## 🔧 **Troubleshooting**

### **Agent Not Available**
- Check if agent name is in `PERMITTED_TOOLS`
- Verify agent is registered in `_register_custom_tools()`
- Ensure agent initialization completed successfully
- Make sure you're passing the actual `config` object to registry functions

### **Agent Not Using Tools**
- Check `available_tools` configuration
- Verify tools are registered in main service
- Ensure tool names match exactly
- Confirm MCP tools are properly initialized if using them

### **Poor Agent Responses**
- Review system prompt for clarity
- Adjust reasoning effort level
- Consider model configuration overrides
- Test with simpler tasks first
- Check if streaming is working properly

### **Streaming Issues**
- Verify `stream_chat_request()` is being used
- Check that tool calling is enabled in agent execution
- Ensure reasoning content is being printed correctly
- Test with simple tasks first to isolate issues

## 🚀 **Advanced Features**

### **Chaining Agents**
Agents can call other agents by including them in their available tools:

```python
# Create a coordinator agent that can use other agents
coordinator = AgentTool(
    name="coordinator",
    description="Coordinates multiple agents for complex tasks",
    system_prompt="You coordinate other agents to solve complex problems...",
    available_tools=["research_agent", "creative_agent", "technical_agent"]
)
```

### **Conditional Tool Access**
Agents can have different tools based on context:

```python
# Research agent with conditional tools
research_agent = AgentTool(
    name="research_agent",
    description="Research specialist",
    system_prompt="You are a research specialist...",
    available_tools=["brave_web_search"]  # Only search tools
)
```

### **Model-Specific Agents**
Different agents can use different models:

```python
# Creative agent with different model
creative_agent = AgentTool(
    name="creative_agent",
    description="Creative writing specialist",
    system_prompt="You are a creative writer...",
    model_config={"model": "gpt-4", "temperature": 0.8}
)
```

## 📚 **File Structure**

```
backend/router/
├── agent_tool.py          # Core agent implementation with streaming support
├── agent_registry.py      # Helper functions for registration (updated)
├── gpt_service.py         # Main GPT service (updated with streaming)
├── process_llm_response.py # Tool calling logic with streaming
└── AGENT_SYSTEM_README.md # This documentation
```

## 🎉 **Getting Started**

1. **Choose your approach**:
   - Use predefined agents (easiest)
   - Create custom agents (most flexible)

2. **Update your GPT service**:
   - Uncomment agent registration code in `_register_custom_tools()`
   - Add agent names to `PERMITTED_TOOLS`
   - Pass actual `config` object to registry functions

3. **Test the agents**:
   - Start with simple tasks
   - Verify agents are working with streaming
   - Check that tool calling works within agents
   - Adjust configuration as needed

4. **Iterate and improve**:
   - Refine system prompts
   - Adjust tool configurations
   - Add new agents as needed
   - Test streaming and tool calling functionality

## 🔧 **Key Features**

### **Streaming Support**
- All agents use streaming for better performance
- Enables real-time response generation
- Supports tool calling within agent execution

### **Tool Calling in Agents**
- Research agent can use `brave_web_search`
- Agents can use any configured tools
- Full tool calling loop within agent execution

### **Configurable Permissions**
- Each agent can have different tool access
- Main service controls which agents are available
- Flexible tool permission system

The agent system gives you powerful delegation capabilities with streaming support, allowing your main LLM to leverage specialized expertise for different types of tasks!
