import { ApiConfig } from '../../../lib/api/client';

export const defaultConfig = {
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 30000,
    maxRetries: 3,
  } as ApiConfig,
  streaming: {
    batchSize: 10,
    flushInterval: 100,
  },
  memory: {
    contextThreshold: 0.7,
    maxContextMemories: 5,
  },
  chat: {
    maxMessages: 100,
    autoSave: true,
  },
};
