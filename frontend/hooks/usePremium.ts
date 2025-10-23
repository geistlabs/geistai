import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

import { revenuecat } from '../lib/revenuecat';

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    // Initial check
    const checkPremium = async () => {
      setIsLoading(true);

      const premium = await revenuecat.isPremium();
      setIsPremium(premium);

      const info = await revenuecat.getCustomerInfo();
      setCustomerInfo(info);

      setIsLoading(false);
    };

    checkPremium();

    // Listen for purchase updates from RevenueCat
    Purchases.addCustomerInfoUpdateListener(info => {
      // eslint-disable-next-line no-console
      console.log('📡 RevenueCat update received');
      setCustomerInfo(info);

      const hasPremium = info.entitlements.active['premium'] !== undefined;
      // eslint-disable-next-line no-console
      console.log(`   Status: ${hasPremium ? '✅ Premium' : '❌ Free'}`);

      setIsPremium(hasPremium);
    });

    // Note: RevenueCat listeners are automatically cleaned up
    // No manual cleanup needed for this version
  }, []);

  return {
    isPremium,
    isLoading,
    customerInfo,
    refresh: async () => {
      setIsLoading(true);
      const premium = await revenuecat.isPremium();
      setIsPremium(premium);
      const info = await revenuecat.getCustomerInfo();
      setCustomerInfo(info);
      setIsLoading(false);
    },
  };
}
