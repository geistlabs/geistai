import { useQuery } from '@tanstack/react-query';

import { initializeDatabase } from '@/lib/chatStorage';
import { initializeRevenueCat } from '@/lib/revenuecat';

export function useAppInitialization() {
  const {
    isLoading: isDbLoading,
    error: dbError,
    refetch: retryDb,
  } = useQuery({
    queryKey: ['app', 'database', 'init'],
    queryFn: initializeDatabase,
    retry: 3,
    retryDelay: 1000,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const {
    isLoading: isRevenueCatLoading,
    error: revenueCatError,
    refetch: retryRevenueCat,
  } = useQuery({
    queryKey: ['app', 'revenuecat', 'init'],
    queryFn: initializeRevenueCat,
    retry: 1,
    retryDelay: 2000,
    staleTime: Infinity,
    gcTime: Infinity,
    throwOnError: false,
  });

  const isAppReady = !isDbLoading && !dbError;
  const isAnyLoading = isDbLoading || isRevenueCatLoading;
  const hasCriticalError = !!dbError;
  const hasNonCriticalError = !!revenueCatError;

  return {
    isAppReady,
    isAnyLoading,
    isDbLoading,
    isRevenueCatLoading,
    dbError,
    revenueCatError,
    hasCriticalError,
    hasNonCriticalError,
    retryDb,
    retryRevenueCat,
  };
}
