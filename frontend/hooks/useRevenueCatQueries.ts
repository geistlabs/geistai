import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { getProducts, hasActiveEntitlement } from '../lib/revenuecat';

/**
 * Hook to fetch specific products by their identifiers
 * @param productIdentifiers - Array of product identifiers to fetch
 */
export function useProducts(productIdentifiers: string[]) {
  return useQuery({
    queryKey: [...queryKeys.revenueCat.all, 'products', productIdentifiers],
    queryFn: () => getProducts(productIdentifiers),
    enabled: productIdentifiers.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes (products don't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to check if user has a specific entitlement
 * @param entitlementIdentifier - The entitlement identifier to check
 */
export function useEntitlement(entitlementIdentifier: string) {
  return useQuery({
    queryKey: queryKeys.revenueCat.entitlement(entitlementIdentifier),
    queryFn: () => hasActiveEntitlement(entitlementIdentifier),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to check if user is premium (convenience hook)
 * @param entitlementIdentifier - The entitlement identifier to check (default: 'premium')
 */
export function useIsPremium(entitlementIdentifier: string = 'premium') {
  return useEntitlement(entitlementIdentifier);
}
