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
    retry: 3, // Retry 3 times like database
    retryDelay: 1000, // Same as database
    staleTime: Infinity,
    gcTime: Infinity,
    // RevenueCat is critical for paywall functionality
    throwOnError: true,
  });

  const isAppReady =
    !isDbLoading && !isRevenueCatLoading && !dbError && !revenueCatError;
  const hasCriticalError = !!dbError || !!revenueCatError;

  return {
    isAppReady,
    isDbLoading,
    isRevenueCatLoading,
    dbError,
    revenueCatError,
    hasCriticalError,
    retryDb,
    retryRevenueCat,
  };
}
