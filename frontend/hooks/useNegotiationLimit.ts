import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const NEGOTIATION_MESSAGE_COUNT_KEY = 'negotiation_message_count';
const NEGOTIATION_MESSAGE_LIMIT = 3;

export interface UseNegotiationLimitReturn {
  messageCount: number;
  isLimitReached: boolean;
  incrementMessageCount: () => Promise<void>;
  resetMessageCount: () => Promise<void>;
  checkLimit: () => Promise<boolean>;
}

/**
 * Hook to manage negotiation chat message limit
 * Tracks message count globally (persists across chats)
 * Resets only when user becomes premium
 */
export function useNegotiationLimit(): UseNegotiationLimitReturn {
  const [messageCount, setMessageCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load message count from storage on mount
  useEffect(() => {
    const loadMessageCount = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          NEGOTIATION_MESSAGE_COUNT_KEY,
        );
        if (stored !== null) {
          const count = parseInt(stored, 10);
          setMessageCount(isNaN(count) ? 0 : count);
        }
      } catch (error) {
        console.error(
          '[NegotiationLimit] Failed to load message count:',
          error,
        );
        setMessageCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessageCount();
  }, []);

  // Increment message count
  const incrementMessageCount = useCallback(async () => {
    try {
      const newCount = messageCount + 1;
      setMessageCount(newCount);
      await AsyncStorage.setItem(
        NEGOTIATION_MESSAGE_COUNT_KEY,
        newCount.toString(),
      );
    } catch (error) {
      console.error('[NegotiationLimit] Failed to save message count:', error);
    }
  }, [messageCount]);

  // Reset message count (called when user becomes premium)
  const resetMessageCount = useCallback(async () => {
    try {
      setMessageCount(0);
      await AsyncStorage.removeItem(NEGOTIATION_MESSAGE_COUNT_KEY);
    } catch (error) {
      console.error('[NegotiationLimit] Failed to reset message count:', error);
    }
  }, []);

  // Check if limit is reached
  const checkLimit = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NEGOTIATION_MESSAGE_COUNT_KEY);
      if (stored !== null) {
        const count = parseInt(stored, 10);
        return !isNaN(count) && count >= NEGOTIATION_MESSAGE_LIMIT;
      }
      return false;
    } catch (error) {
      console.error('[NegotiationLimit] Failed to check limit:', error);
      return false;
    }
  }, []);

  const isLimitReached = messageCount >= NEGOTIATION_MESSAGE_LIMIT;

  return {
    messageCount,
    isLimitReached: !isLoading && isLimitReached,
    incrementMessageCount,
    resetMessageCount,
    checkLimit,
  };
}
