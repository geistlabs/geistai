# Geist Tool System Architecture

This document explains the refactored tool system in the Geist backend, which supports both MCP (Model Context Protocol) tools and custom tools.

## Overview

The tool system is designed to be:
- **Maintainable**: Clear separation of concerns and well-documented code
- **Extensible**: Easy to add new tools (both MCP and custom)
- **Robust**: Proper error handling and session management
- **Flexible**: Support for different tool types and execution patterns
- **Multi-Gateway**: Support for multiple MCP gateways with automatic routing

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   main.py       │    │   gpt_service.py │    │ simple_mcp_     │
│                 │    │                  │    │ client.py       │
│ - FastAPI app   │───▶│ - Tool registry  │───▶│ - Multi-gateway │
│ - Endpoints     │    │ - Tool execution │    │ - MCP protocol  │
│ - Request/      │    │ - LLM integration│    │ - Auto-routing  │
│   response      │    │                  │    │ - Session mgmt  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Tool Types     │
                       │                  │
                       │ - MCP Tools      │
                       │ - Custom Tools   │
                       │ - Future: API    │
                       │   Tools, etc.    │
                       └──────────────────┘
```

## Key Components

### 1. GptService (`gpt_service.py`)

The main service that orchestrates everything:

- **Tool Registry**: Central registry of all available tools
- **Tool Execution**: Unified interface for executing any tool type
- **LLM Integration**: Handles tool calling with the language model
- **Message Preparation**: Formats conversations for the LLM

### 2. SimpleMCPClient (`simple_mcp_client.py`)

Handles MCP protocol communication with multiple gateways:

- **Multi-Gateway Support**: Connects to multiple MCP gateways simultaneously
- **Automatic Routing**: Routes tool calls to the correct gateway
- **Connection Management**: Establishes and maintains MCP sessions per gateway
- **Protocol Handling**: Manages JSON-RPC and SSE parsing
- **Tool Discovery**: Lists and caches available MCP tools from all gateways
- **Tool Execution**: Calls MCP tools through the appropriate gateway

### 3. Main App (`main.py`)

FastAPI application with endpoints:

- **Chat Endpoints**: `/api/chat` and `/api/chat/stream`
- **Tool Management**: `/api/tools` and `/api/tools/{name}/test`
- **Health Checks**: `/health` and `/ssl/info`
- **Service Lifecycle**: Startup/shutdown event handlers

## Multi-Gateway MCP Setup

### Configuration

The system supports multiple MCP gateways through environment variables:

```bash
# Individual gateway URLs
MCP_BRAVE_URL=http://mcp-brave:3000
MCP_FETCH_URL=http://mcp-fetch:8000

# Comma-separated list of all gateways
MCP_GATEWAY_URLS=http://mcp-brave:3000,http://mcp-fetch:8000
```

### Docker Compose Integration

In your `docker-compose.yml`, the MCP services are configured as:

```yaml
services:
  router:
    environment:
      - MCP_BRAVE_URL=http://mcp-brave:3000
      - MCP_FETCH_URL=http://mcp-fetch:8000
      - MCP_GATEWAY_URLS=http://mcp-brave:3000,http://mcp-fetch:8000
    depends_on:
      - mcp-brave
      - mcp-fetch

  mcp-brave:
    image: mcp/brave-search:latest
    ports:
      - "3001:3000"  # Exposed on host port 3001
    networks:
      - geist-network

  mcp-fetch:
    image: mcp/fetch:latest
    ports:
      - "3002:8000"  # Exposed on host port 3002
    networks:
      - geist-network
```

### Usage in Code

```python
import os
from simple_mcp_client import SimpleMCPClient

# Option 1: Use environment variable
mcp_urls = os.getenv("MCP_GATEWAY_URLS", "").split(",")
mcp_urls = [url.strip() for url in mcp_urls if url.strip()]

# Option 2: Use individual URLs
brave_url = os.getenv("MCP_BRAVE_URL", "http://mcp-brave:3000")
fetch_url = os.getenv("MCP_FETCH_URL", "http://mcp-fetch:8000")
mcp_urls = [brave_url, fetch_url]

# Create client with multiple gateways
client = SimpleMCPClient(mcp_urls)

async with client:
    await client.connect()  # Connects to ALL gateways
    
    # Lists tools from ALL gateways (user doesn't know which is which)
    tools = await client.list_tools()
    
    # Calls tool on appropriate gateway automatically
    result = await client.call_tool("brave_web_search", {"query": "AI news"})
    result = await client.call_tool("fetch", {"url": "https://example.com"})
```

## How to Add Custom Tools

### Step 1: Define the Tool Function

Create an async function that implements your tool:

```python
async def my_custom_tool(arguments: dict) -> dict:
    """
    Your custom tool implementation
    
    Args:
        arguments: Dictionary of arguments from the LLM
        
    Returns:
        dict with 'content' or 'error' key
    """
    try:
        # Extract arguments
        query = arguments.get("query", "")
        
        # Do your tool's work
        result = do_something_with_query(query)
        
        # Return success result
        return {
            "content": result,
            "status": "success"
        }
        
    except Exception as e:
        # Return error result
        return {
            "error": str(e),
            "status": "error"
        }
```

### Step 2: Register the Tool

Add your tool to the `_register_custom_tools()` method in `gpt_service.py`:

```python
async def _register_custom_tools(self):
    """Register custom (non-MCP) tools here"""
    
    # Your custom tool
    self._register_tool(
        name="my_custom_tool",
        description="What your tool does - this is shown to the LLM",
        input_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query or input parameter"
                }
            },
            "required": ["query"]
        },
        executor=my_custom_tool,
        tool_type="custom"
    )
```

### Step 3: Enable the Tool

Add your tool name to the `PERMITTED_TOOLS` list in `gpt_service.py`:

```python
PERMITTED_TOOLS = [
    "brave_web_search",  # MCP tool from brave gateway
    "fetch",             # MCP tool from fetch gateway
    "my_custom_tool",    # Your custom tool
]
```

### Step 4: Test Your Tool

You can test your tool using the API:

```bash
# List all tools (from all gateways + custom)
curl http://localhost:8000/api/tools

# Test your tool
curl -X POST http://localhost:8000/api/tools/my_custom_tool/test \
  -H "Content-Type: application/json" \
  -d '{"query": "test input"}'
```

## Tool Types

### MCP Tools

- **Source**: MCP Gateways (Docker containers)
- **Protocol**: Model Context Protocol
- **Examples**: `brave_web_search` (from brave gateway), `fetch` (from fetch gateway)
- **Management**: Automatically discovered and registered from all gateways
- **Routing**: Automatically routed to the correct gateway

### Custom Tools

- **Source**: Defined in `gpt_service.py`
- **Protocol**: Direct function calls
- **Examples**: Calculator, file operations, API calls
- **Management**: Manually registered in `_register_custom_tools()`

## Configuration

### Environment Variables

```bash
# MCP Multi-Gateway Configuration
MCP_BRAVE_URL=http://mcp-brave:3000
MCP_FETCH_URL=http://mcp-fetch:8000
MCP_GATEWAY_URLS=http://mcp-brave:3000,http://mcp-fetch:8000

# Tool Permissions
PERMITTED_TOOLS=["brave_web_search", "fetch", "my_custom_tool"]

# LLM Configuration
OPENAI_API_KEY=your-key-here
INFERENCE_URL=http://inference:8080
```

### Tool Registry Structure

Each tool in the registry has this structure:

```python
{
    "name": "tool_name",
    "description": "What the tool does",
    "input_schema": {
        "type": "object",
        "properties": {...},
        "required": [...]
    },
    "executor": async_function,
    "type": "mcp" | "custom"
}
```

For MCP tools, the executor is automatically generated and handles routing to the correct gateway.

## Error Handling

The system handles errors at multiple levels:

1. **Tool Execution Errors**: Caught and returned as error results
2. **MCP Connection Errors**: Logged, service continues without failed gateways
3. **Gateway Routing Errors**: Tool calls fail gracefully if gateway is unavailable
4. **LLM Errors**: Propagated to client with appropriate HTTP status
5. **Validation Errors**: Returned as 400 Bad Request

## Testing

### Unit Tests

```bash
# Test MCP client with multiple gateways
python simple_mcp_client.py

# Test GPT service
python -c "from gpt_service import GptService; print('Import successful')"
```

### Integration Tests

```bash
# Test tool listing (from all gateways)
curl http://localhost:8000/api/tools

# Test chat with tools (auto-routed to correct gateway)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Search for latest AI news"}'
```

## Troubleshooting

### Common Issues

1. **Tool not found**: Check `PERMITTED_TOOLS` list
2. **MCP connection failed**: Check gateway container status
3. **Tool execution error**: Check tool function implementation
4. **Schema validation error**: Verify `input_schema` format
5. **Gateway routing error**: Check if specific gateway is running

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Health Check

Check system status:

```bash
curl http://localhost:8000/health
```

### Gateway Status

Check individual gateway status:

```bash
# Check brave gateway
curl http://localhost:3001/health

# Check fetch gateway  
curl http://localhost:3002/health
```

## Future Extensions

The system is designed to support:

- **API Tools**: Tools that call external APIs
- **Database Tools**: Tools that query databases
- **File System Tools**: Tools that manipulate files
- **Plugin System**: Dynamic tool loading
- **Tool Chaining**: Tools that call other tools
- **Gateway Load Balancing**: Distribute load across multiple gateways
- **Gateway Failover**: Automatic failover to backup gateways

## Best Practices

1. **Tool Naming**: Use descriptive, snake_case names
2. **Error Handling**: Always return structured error responses
3. **Documentation**: Document tool purpose and parameters
4. **Testing**: Test tools thoroughly before deployment
5. **Security**: Validate all inputs and sanitize outputs
6. **Performance**: Consider caching for expensive operations
7. **Gateway Management**: Monitor gateway health and availability
8. **Tool Routing**: Ensure tools are properly routed to their gateways

## Migration Guide

If you're upgrading from the old system:

1. **Update imports**: Use new `GptService` class
2. **Initialize tools**: Call `init_tools()` on startup
3. **Update endpoints**: Use new streaming interface
4. **Configure gateways**: Set up `MCP_GATEWAY_URLS` environment variable
5. **Test thoroughly**: Verify all tools work correctly across gateways

The new system is backward compatible, but provides much better maintainability, extensibility, and multi-gateway support.