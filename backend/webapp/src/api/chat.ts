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

// Send a message to the chat API
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
