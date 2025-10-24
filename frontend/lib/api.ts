import { revenuecat } from './revenuecat';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get headers for API requests including user authentication
 */
export async function getApiHeaders(): Promise<Record<string, string>> {
  const userId = await revenuecat.getAppUserId();

  return {
    'Content-Type': 'application/json',
    'X-User-ID': userId, // Send RevenueCat user ID
  };
}

/**
 * Make authenticated API request
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = await getApiHeaders();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  // Handle premium required error
  if (response.status === 403) {
    const error = await response.json();
    if (error.error === 'premium_required') {
      // Show paywall or upgrade prompt
      throw new Error('PREMIUM_REQUIRED');
    }
  }

  return response;
}

/**
 * Send chat message with premium verification
 */
export async function sendChatMessage(message: string, history: any[] = []) {
  try {
    const response = await fetchWithAuth('/api/stream', {
      method: 'POST',
      body: JSON.stringify({
        message,
        messages: history,
      }),
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'PREMIUM_REQUIRED') {
      // Show paywall
      throw new Error('PREMIUM_REQUIRED');
    }
    throw error;
  }
}

/**
 * Transcribe audio with premium verification
 */
export async function transcribeAudio(audioUri: string, language?: string) {
  try {
    const userId = await revenuecat.getAppUserId();

    const formData = new FormData();
    formData.append('audio_file', {
      uri: audioUri,
      type: 'audio/wav',
      name: 'audio.wav',
    } as any);

    if (language) {
      formData.append('language', language);
    }

    const response = await fetch(`${API_BASE_URL}/api/speech-to-text`, {
      method: 'POST',
      headers: {
        'X-User-ID': userId,
      },
      body: formData,
    });

    if (response.status === 403) {
      const error = await response.json();
      if (error.error === 'premium_required') {
        throw new Error('PREMIUM_REQUIRED');
      }
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'PREMIUM_REQUIRED') {
      throw new Error('PREMIUM_REQUIRED');
    }
    throw error;
  }
}

/**
 * Create embeddings with premium verification
 */
export async function createEmbeddings(text: string) {
  try {
    const response = await fetchWithAuth('/embeddings/embed', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'PREMIUM_REQUIRED') {
      throw new Error('PREMIUM_REQUIRED');
    }
    throw error;
  }
}
