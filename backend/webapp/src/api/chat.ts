// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  onCitations: (citations: any[]) => void,
  onComplete: () => void,
  onError: (error: string) => void
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

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        console.log("Incoming chunk:", chunk)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if ((data.token || data.new_citations)&& data.agent === "orchestrator") {
                if (data.token) {
                  onToken(data.token)
                }
                if (data.new_citations) {
                  onCitations(data.new_citations)
                }
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
