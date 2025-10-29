/**
 * App-wide context for environment detection and premium status
 * Uses TanStack Query only for premium status (which benefits from caching)
 * Does NOT contain business logic - just provides data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext } from 'react';

import { useEnvironmentContext } from '../hooks/useEnvironment';
import { revenuecat } from '../lib/revenuecat';
import { isExpoGo, isNativeBuild } from '../lib/utils/environment';

export interface AppState {
  // Environment
  isExpoGo: boolean;
  isNativeBuild: boolean;

  // Premium status
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AppActions {
  checkPremiumStatus: () => Promise<void>;
  refreshAppState: () => Promise<void>;
}

const AppContext = createContext<{
  state: AppState;
  actions: AppActions;
} | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

interface AppProviderProps {
  children: React.ReactNode;
}

// Query keys
const QUERY_KEYS = {
  premiumStatus: ['premiumStatus'] as const,
} as const;

// Premium status query - this benefits from caching and background updates
function usePremiumStatusQuery(
  isExpoGoEnv: boolean,
  isNativeBuildEnv: boolean,
) {
  return useQuery({
    queryKey: QUERY_KEYS.premiumStatus,
    queryFn: async () => {
      if (isExpoGoEnv) {
        // Expo Go: Always treat as premium (bypass RevenueCat)
        console.log('📱 [AppProvider] Expo Go detected - treating as premium');
        return { isPremium: true };
      } else if (isNativeBuildEnv) {
        // Native build: Use real RevenueCat
        console.log(
          '📱 [AppProvider] Native build detected - initializing RevenueCat',
        );
        await revenuecat.initialize();
        const isPremium = await revenuecat.isPremiumUser();
        return { isPremium };
      } else {
        // Fallback
        return { isPremium: false };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
}

export function AppProvider({ children }: AppProviderProps) {
  const queryClient = useQueryClient();

  // Environment detection using custom hook
  const { isExpoGo: isExpoGoEnv, isNativeBuild: isNativeBuildEnv } =
    useEnvironmentContext();

  // Premium status - this benefits from useQuery
  const {
    data: premiumData,
    isLoading: premiumLoading,
    error: premiumError,
    refetch: refetchPremium,
  } = usePremiumStatusQuery(isExpoGoEnv, isNativeBuildEnv);

  // Compute app state - just data, no business logic
  const state: AppState = {
    isExpoGo: isExpoGoEnv,
    isNativeBuild: isNativeBuildEnv,
    isPremium: premiumData?.isPremium ?? false,
    isLoading: premiumLoading,
    error: premiumError?.message || null,
  };

  const checkPremiumStatus = async () => {
    if (isExpoGo()) {
      // Expo Go: Always premium
      queryClient.setQueryData(QUERY_KEYS.premiumStatus, {
        isPremium: true,
      });
      return;
    }

    if (isNativeBuild()) {
      try {
        const isPremium = await revenuecat.isPremiumUser();
        queryClient.setQueryData(QUERY_KEYS.premiumStatus, {
          isPremium,
        });
      } catch (error) {
        console.error(
          '❌ [AppProvider] Failed to check premium status:',
          error,
        );
        throw error;
      }
    }
  };

  const refreshAppState = async () => {
    await refetchPremium();
  };

  const actions: AppActions = {
    checkPremiumStatus,
    refreshAppState,
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}
