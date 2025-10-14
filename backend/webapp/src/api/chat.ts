// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentMessage {
  agent: string
  content: string
  timestamp: number
  type: 'start' | 'token' | 'complete' | 'error'
  status?: string
  citations?: any[]
  meta?: any
}

export interface ChatRequest {
  message: string
  messages?: ChatMessage[]
}

export interface ChatResponse {
  response: string
}

export interface ChatError {
  error: string
}

// Send a message to the chat API (non-streaming)
export async function sendMessage(message: string, conversationHistory?: ChatMessage[]): Promise<{ content: string }> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: ChatResponse = await response.json()
    return { content: data.response }
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

// Streaming chat interface
export interface StreamChunk {
  token: string;
  sequence: number;
}

export interface StreamEnd {
  finished: boolean;
}

export interface StreamError {
  error: string;
}

export type StreamEvent = StreamChunk | StreamEnd | StreamError;

// Send a streaming message to the chat API
export async function sendStreamingMessage(
  message: string, 
  conversationHistory: ChatMessage[],
  onToken: (token: string) => void,
  onSubAgentEvent: (agentEvent: {agent: string, token: string, isStreaming?: boolean, task?: string, context?: string}) => void,
  onToolCallEvent: (toolCallEvent: {type: string, toolName: string, arguments?: any, result?: any, error?: string}) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    console.log(response.status, "response.status")
    if (!response.ok) {
      console.log(response.status, "response.status")
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      console.log(response.status, "response.status")
      throw new Error('No response body received')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()

        console.log(done, "done") 
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        console.log(chunk, "chunk")
        const lines = chunk.split('\n')

        for (const line of lines) {
          console.log("line", line)
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              console.log("data", data)
              if (data.type === "final_response") {
               console.log("final_response", data)
               console.log("Citations in final_response:", data.citations)
               console.log("Number of citations:", data.citations ? data.citations.length : 0)
              }
              
              if (data.type === "orchestrator_token") {
                if (data.data.content) {
                  onToken(data.data.content)
                }
              } else if (data.type === "sub_agent_event" ) {
                if (data.data.type === "agent_token" && data.data.data.content) {
                onSubAgentEvent({
                    agent: data.data.data.agent,
                    token: data.data.data.content,

                  })
                }
                if (data.data.type === "agent_start") {
                  onSubAgentEvent({
                    agent: data.data.data.agent,
                    token: "Sub Agent tokens: ",
                    isStreaming: true,
                    task: data.data.data.input,
                    context: data.data.data.context
                  })
                }
                if (data.data.type === "agent_complete") {
                  onSubAgentEvent({
                    agent: data.data.data.agent,
                    token: data.data.data.content,
                    isStreaming: false
                  })
                }
                if (data.data.type === "tool_call_event") {
                  // Handle tool call events from sub-agents
                  console.log("🔍 Sub-agent tool call event structure:", data)
                  const toolCallEventData = data.data.data
                  const toolCallData = toolCallEventData.data
                  const eventType = toolCallEventData.type
                  
                  if (eventType === "tool_call_start" && toolCallData && toolCallData.tool_name) {
                    console.log(`🔧 Sub-agent ${data.data.agent} tool call started: ${toolCallData.tool_name}`, toolCallData.arguments)
                    onToolCallEvent({
                      type: "start",
                      toolName: toolCallData.tool_name,
                      arguments: toolCallData.arguments
                    })
                  } else if (eventType === "tool_call_complete" && toolCallData && toolCallData.tool_name) {
                    console.log(`✅ Sub-agent ${data.data.agent} tool call completed: ${toolCallData.tool_name}`, toolCallData.result)
                    onToolCallEvent({
                      type: "complete",
                      toolName: toolCallData.tool_name,
                      arguments: toolCallData.arguments,
                      result: toolCallData.result
                    })
                  } else if (eventType === "tool_call_error" && toolCallData && toolCallData.tool_name) {
                    console.log(`❌ Sub-agent ${data.data.agent} tool call error: ${toolCallData.tool_name}`, toolCallData.error)
                    onToolCallEvent({
                      type: "error",
                      toolName: toolCallData.tool_name,
                      arguments: toolCallData.arguments,
                      error: toolCallData.error
                    })
                  } else {
                    console.warn("🔍 Invalid tool call event data:", { eventType, toolCallData, data })
                  }
                }


              } else if (data.type === "tool_call_event") {
                // Handle tool call events
                if (data.data.type === "tool_call_start") {
                  console.log(`🔧 Tool call started: ${data.data.data.tool_name}`, data.data.data.arguments)
                  onToolCallEvent({
                    type: "start",
                    toolName: data.data.data.tool_name,
                    arguments: data.data.data.arguments
                  })
                } else if (data.data.type === "tool_call_complete") {
                  console.log(`✅ Tool call completed: ${data.data.data.tool_name}`, data.data.data.result)
                  onToolCallEvent({
                    type: "complete",
                    toolName: data.data.data.tool_name,
                    arguments: data.data.data.arguments,
                    result: data.data.data.result
                  })
                } else if (data.data.type === "tool_call_error") {
                  console.log(`❌ Tool call error: ${data.data.data.tool_name}`, data.data.data.error)
                  onToolCallEvent({
                    type: "error",
                    toolName: data.data.data.tool_name,
                    arguments: data.data.data.arguments,
                    error: data.data.data.error
                  })
                }

              } else if (data.type === "orchestrator_start") {
                // Handle orchestrator start event
              
              } else if (data.type === "orchestrator_complete") {
                console.log("orchestrator_complete", data)
                // Handle orchestrator completion
          
              } else if (data.type === "final_response") {
                // Handle final response (citations are now parsed from text)
                console.log("Processing final_response event")
                console.log("Final response data:", data)
              } else if (data.finished) {
                onComplete()
                return
              } else if (data.error) {
                onError(data.error)
                return
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    console.error('Error in streaming chat:', error)
    onError(error instanceof Error ? error.message : 'Unknown error occurred')
  }
}

// Agent message utilities
export function createAgentMessage(
  agent: string,
  content: string,
  type: 'start' | 'token' | 'complete' | 'error',
  status?: string,
  citations?: any[],
  meta?: any
): AgentMessage {
  return {
    agent,
    content,
    timestamp: Date.now(),
    type,
    status,
    citations,
    meta
  }
}

export function groupAgentMessagesByAgent(messages: AgentMessage[]): Record<string, AgentMessage[]> {
  return messages.reduce((groups, message) => {
    if (!groups[message.agent]) {
      groups[message.agent] = []
    }
    groups[message.agent].push(message)
    return groups
  }, {} as Record<string, AgentMessage[]>)
}

export function getAgentDisplayName(agentName: string): string {
  const displayNames: Record<string, string> = {
    'main_orchestrator': 'Main Orchestrator',
    'research_agent': 'Research Agent',
    'current_info_agent': 'Current Info Agent',
    'creative_agent': 'Creative Agent',
    'technical_agent': 'Technical Agent',
    'summary_agent': 'Summary Agent'
  }
  return displayNames[agentName] || agentName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Health check function
export async function checkHealth(): Promise<{ status: string; ssl_enabled: boolean; ssl_status: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Health check error:', error)
    throw error
  }
}
