/**
 * Query keys for TanStack Query
 * Centralized query key management for consistent caching and invalidation
 */

export const queryKeys = {
  // RevenueCat related queries
  revenueCat: {
    all: ['revenueCat'] as const,
    customerInfo: () => [...queryKeys.revenueCat.all, 'customerInfo'] as const,
    offerings: () => [...queryKeys.revenueCat.all, 'offerings'] as const,
    entitlement: (entitlementId: string) =>
      [...queryKeys.revenueCat.all, 'entitlement', entitlementId] as const,
    isPremium: (entitlementId: string) =>
      [...queryKeys.revenueCat.all, 'isPremium', entitlementId] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
