import { useCallback, useEffect, useState } from 'react';

import { useRevenueCat } from './useRevenueCat';

interface UsePaywallOptions {
  showOnStartup?: boolean;
  entitlementIdentifier?: string;
  userId?: string;
}

interface UsePaywallReturn {
  // Paywall state
  isPaywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;

  // Subscription state
  isPremium: boolean;
  isLoading: boolean;
  error: Error | null;

  // Actions
  handlePurchaseSuccess: () => void;
  handleRestoreSuccess: () => void;
}

export function usePaywall({
  showOnStartup = true,
  entitlementIdentifier = 'premium',
  userId,
}: UsePaywallOptions = {}): UsePaywallReturn {
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [hasShownStartupPaywall, setHasShownStartupPaywall] = useState(false);

  const { isSubscribed, isLoading, error, purchase, restore } = useRevenueCat(
    entitlementIdentifier,
    userId,
  );

  // Show paywall on startup if user is not premium
  useEffect(() => {
    if (showOnStartup && !isLoading && !hasShownStartupPaywall) {
      if (isSubscribed === false) {
        console.log(
          '🚪 [Paywall] Showing startup paywall - user is not premium',
        );
        setIsPaywallVisible(true);
        setHasShownStartupPaywall(true);
      } else if (isSubscribed === true) {
        console.log('✅ [Paywall] User is premium - skipping startup paywall');
        setHasShownStartupPaywall(true);
      }
    }
  }, [isSubscribed, isLoading, showOnStartup, hasShownStartupPaywall]);

  const showPaywall = useCallback(() => {
    console.log('🚪 [Paywall] Manually showing paywall');
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    console.log('🚪 [Paywall] Hiding paywall');
    setIsPaywallVisible(false);
  }, []);

  const handlePurchaseSuccess = useCallback(() => {
    console.log('🎉 [Paywall] Purchase successful - hiding paywall');
    setIsPaywallVisible(false);
  }, []);

  const handleRestoreSuccess = useCallback(() => {
    console.log('🔄 [Paywall] Restore successful - hiding paywall');
    setIsPaywallVisible(false);
  }, []);

  return {
    isPaywallVisible,
    showPaywall,
    hidePaywall,
    isPremium: isSubscribed === true,
    isLoading,
    error: error ? new Error(error) : null,
    handlePurchaseSuccess,
    handleRestoreSuccess,
  };
}
