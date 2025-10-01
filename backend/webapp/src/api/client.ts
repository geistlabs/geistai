// API client configuration and utilities

// Get API URL from runtime config (set by Docker entrypoint) or fallback to build-time env var
function getApiUrl(): string {
  // Check if runtime config is available (set by Docker entrypoint)
  if (typeof window !== 'undefined' && (window as any).RUNTIME_CONFIG?.API_URL) {
    return (window as any).RUNTIME_CONFIG.API_URL;
  }
  // Fallback to build-time environment variable
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}

export const API_CONFIG = {
  get baseUrl() { return getApiUrl(); },
  timeout: 30000, // 30 seconds
}

// Create a fetch wrapper with timeout
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout: number = API_CONFIG.timeout
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

// Generic API error handler
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'An unknown error occurred'
}
