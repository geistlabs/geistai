import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { queryKeys } from '../lib/queryKeys';
import {
  getCustomerInfo,
  getOfferings,
  hasActiveEntitlement,
  identifyUser,
  isPremium,
  purchasePackage,
  resetUser,
  restorePurchases,
} from '../lib/revenuecat';

/**
 * Hook for managing subscription state and RevenueCat operations using TanStack Query
 *
 * @param entitlementIdentifier - The entitlement identifier to check (default: 'premium')
 * @param userId - Optional user ID to identify the user on mount
 */
export function useRevenueCat(
  entitlementIdentifier: string = 'premium',
  userId?: string,
) {
  const queryClient = useQueryClient();

  // Query for customer info
  const {
    data: customerInfo,
    isLoading: isLoadingCustomerInfo,
    error: customerInfoError,
    refetch: refetchCustomerInfo,
  } = useQuery({
    queryKey: queryKeys.revenueCat.customerInfo(),
    queryFn: getCustomerInfo,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query for offerings
  const {
    data: offerings,
    isLoading: isLoadingOfferings,
    error: offeringsError,
    refetch: refetchOfferings,
  } = useQuery({
    queryKey: queryKeys.revenueCat.offerings(),
    queryFn: getOfferings,
    staleTime: 10 * 60 * 1000, // 10 minutes (offerings change less frequently)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Query for entitlement status
  const {
    data: isSubscribed,
    isLoading: isLoadingEntitlement,
    error: entitlementError,
  } = useQuery({
    queryKey: queryKeys.revenueCat.entitlement(entitlementIdentifier),
    queryFn: () => hasActiveEntitlement(entitlementIdentifier),
    enabled: !!customerInfo, // Only run when we have customer info
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for purchasing a package
  const purchaseMutation = useMutation({
    mutationFn: purchasePackage,
    onSuccess: (newCustomerInfo: CustomerInfo) => {
      // Update customer info in cache
      queryClient.setQueryData(
        queryKeys.revenueCat.customerInfo(),
        newCustomerInfo,
      );

      // Invalidate entitlement queries to refetch subscription status
      queryClient.invalidateQueries({
        queryKey: queryKeys.revenueCat.entitlement(entitlementIdentifier),
      });
    },
    onError: error => {
      console.error('Purchase failed:', error);
    },
  });

  // Mutation for restoring purchases
  const restoreMutation = useMutation({
    mutationFn: restorePurchases,
    onSuccess: (newCustomerInfo: CustomerInfo) => {
      // Update customer info in cache
      queryClient.setQueryData(
        queryKeys.revenueCat.customerInfo(),
        newCustomerInfo,
      );

      // Invalidate entitlement queries to refetch subscription status
      queryClient.invalidateQueries({
        queryKey: queryKeys.revenueCat.entitlement(entitlementIdentifier),
      });
    },
    onError: error => {
      console.error('Restore failed:', error);
    },
  });

  // Mutation for identifying user
  const identifyMutation = useMutation({
    mutationFn: identifyUser,
    onSuccess: () => {
      // Invalidate all RevenueCat queries to refetch with new user
      queryClient.invalidateQueries({
        queryKey: queryKeys.revenueCat.all,
      });
    },
    onError: error => {
      console.error('Identify user failed:', error);
    },
  });

  // Mutation for resetting user
  const resetMutation = useMutation({
    mutationFn: resetUser,
    onSuccess: () => {
      // Clear all RevenueCat data from cache
      queryClient.removeQueries({
        queryKey: queryKeys.revenueCat.all,
      });
    },
    onError: error => {
      console.error('Reset user failed:', error);
    },
  });

  // Computed loading state
  const isLoading =
    isLoadingCustomerInfo || isLoadingOfferings || isLoadingEntitlement;

  // Computed error state
  const error = customerInfoError || offeringsError || entitlementError;

  // Purchase a package
  const purchase = useCallback(
    async (packageToPurchase: PurchasesPackage) => {
      return purchaseMutation.mutateAsync(packageToPurchase);
    },
    [purchaseMutation],
  );

  // Restore purchases
  const restore = useCallback(async () => {
    return restoreMutation.mutateAsync();
  }, [restoreMutation]);

  // Identify user
  const identify = useCallback(
    async (userId: string) => {
      return identifyMutation.mutateAsync(userId);
    },
    [identifyMutation],
  );

  // Reset user
  const reset = useCallback(async () => {
    return resetMutation.mutateAsync();
  }, [resetMutation]);

  // Check if user is premium (convenience method)
  const checkPremium = useCallback(async () => {
    try {
      const premium = await isPremium(entitlementIdentifier);
      // Update the cache with the new premium status
      queryClient.setQueryData(
        queryKeys.revenueCat.entitlement(entitlementIdentifier),
        premium,
      );
      return premium;
    } catch (err) {
      console.error('Error checking premium status:', err);
      return false;
    }
  }, [entitlementIdentifier, queryClient]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([refetchCustomerInfo(), refetchOfferings()]);
  }, [refetchCustomerInfo, refetchOfferings]);

  // Auto-identify user if provided
  if (userId && !identifyMutation.isPending && !identifyMutation.isSuccess) {
    identify(userId);
  }

  return {
    // State
    customerInfo: customerInfo || null,
    offerings: offerings || null,
    isLoading,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isIdentifying: identifyMutation.isPending,
    isResetting: resetMutation.isPending,
    error: error?.message || null,
    isSubscribed: isSubscribed || false,

    // Actions
    purchase,
    restore,
    identify,
    reset,
    checkPremium,
    refresh,

    // Mutation states for fine-grained control
    purchaseMutation,
    restoreMutation,
    identifyMutation,
    resetMutation,
  };
}
