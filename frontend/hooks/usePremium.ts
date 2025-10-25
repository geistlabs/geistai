/**
 * Premium subscription management hook
 * Handles RevenueCat integration and premium status
 */

import { useCallback, useEffect, useState } from 'react';

import { CustomerInfo, revenuecat } from '../lib/revenuecat';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
  customerInfo: CustomerInfo | null;
}

export interface PremiumActions {
  checkPremiumStatus: () => Promise<void>;
  purchaseSubscription: (packageId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  // Development helpers
  setPremiumStatus: (isPremium: boolean) => void;
  togglePremiumStatus: () => boolean;
}

export function usePremium() {
  const [status, setStatus] = useState<PremiumStatus>({
    isPremium: false,
    isLoading: true,
    error: null,
    customerInfo: null,
  });

  const initializePremium = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      // Initialize RevenueCat
      await revenuecat.initialize();

      // Get customer info
      const customerInfo = await revenuecat.getCustomerInfo();
      const isPremium = await revenuecat.isPremiumUser();

      setStatus({
        isPremium,
        isLoading: false,
        error: null,
        customerInfo,
      });

      console.log('✅ [Premium] Status updated:', { isPremium, customerInfo });
    } catch (error) {
      console.error('❌ [Premium] Initialization failed:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize premium',
      }));
    }
  }, []);

  const checkPremiumStatus = useCallback(async () => {
    try {
      const isPremium = await revenuecat.isPremiumUser();
      const customerInfo = await revenuecat.getCustomerInfo();

      setStatus(prev => ({
        ...prev,
        isPremium,
        customerInfo,
        error: null,
      }));

      return isPremium;
    } catch (error) {
      console.error('❌ [Premium] Status check failed:', error);
      setStatus(prev => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check premium status',
      }));
      return false;
    }
  }, []);

  const purchaseSubscription = useCallback(
    async (packageToPurchase: any) => {
      try {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }));

        const result = await revenuecat.purchasePackage(packageToPurchase);

        // Update status after successful purchase
        await checkPremiumStatus();

        console.log('✅ [Premium] Purchase successful:', result);
        return result;
      } catch (error) {
        console.error('❌ [Premium] Purchase failed:', error);
        setStatus(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Purchase failed',
        }));
        throw error;
      }
    },
    [checkPremiumStatus],
  );

  const restorePurchases = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await revenuecat.restorePurchases();

      // Update status after restore
      await checkPremiumStatus();

      console.log('✅ [Premium] Purchases restored:', result);
      return result;
    } catch (error) {
      console.error('❌ [Premium] Restore failed:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Restore failed',
      }));
      throw error;
    }
  }, [checkPremiumStatus]);

  const getOfferings = useCallback(async () => {
    try {
      return await revenuecat.getOfferings();
    } catch (error) {
      console.error('❌ [Premium] Failed to get offerings:', error);
      throw error;
    }
  }, []);

  // Development helpers for testing
  const setPremiumStatus = useCallback((isPremium: boolean) => {
    revenuecat.setPremiumStatus(isPremium);
    setStatus(prev => ({ ...prev, isPremium }));
  }, []);

  const togglePremiumStatus = useCallback(() => {
    const newStatus = revenuecat.togglePremiumStatus();
    setStatus(prev => ({ ...prev, isPremium: newStatus }));
    return newStatus;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializePremium();
  }, [initializePremium]);

  return {
    ...status,
    checkPremiumStatus,
    purchaseSubscription,
    restorePurchases,
    getOfferings,
    initializePremium,
    // Development helpers
    setPremiumStatus,
    togglePremiumStatus,
  };
}
