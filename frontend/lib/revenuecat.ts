import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

import { config } from './config';

class RevenueCatService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🔧 Initializing RevenueCat...');

      // Configure SDK
      Purchases.configure({ apiKey: config.revenuecat.publicKey });

      // Enable debug logs in development
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      this.initialized = true;
      console.log('✅ RevenueCat initialized');
    } catch (error) {
      console.error('❌ RevenueCat init failed:', error);
      throw error;
    }
  }

  async isPremium(): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement =
        customerInfo.entitlements.active[config.revenuecat.entitlementId];
      const hasPremium = entitlement !== undefined;

      console.log(`🔍 Premium check: ${hasPremium ? '✅' : '❌'}`);

      if (hasPremium && entitlement) {
        console.log(`   Expires: ${entitlement.expirationDate}`);
      }

      return hasPremium;
    } catch (error) {
      console.error('❌ Premium check failed:', error);
      return false;
    }
  }

  async getOffering(): Promise<PurchasesOffering | null> {
    try {
      console.log('📦 Fetching offerings...');
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.warn('⚠️ No current offering found');
        return null;
      }

      console.log(`✅ Found offering: ${offerings.current.identifier}`);
      console.log(`   Packages: ${offerings.current.availablePackages.length}`);

      return offerings.current;
    } catch (error) {
      console.error('❌ Get offerings failed:', error);
      return null;
    }
  }

  async purchase(packageToPurchase: PurchasesPackage): Promise<boolean> {
    try {
      console.log(`💳 Purchasing: ${packageToPurchase.product.identifier}`);

      const { customerInfo } =
        await Purchases.purchasePackage(packageToPurchase);

      const isPremium =
        customerInfo.entitlements.active[config.revenuecat.entitlementId] !==
        undefined;

      console.log(`✅ Purchase complete! Premium: ${isPremium}`);

      return isPremium;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('ℹ️ User cancelled purchase');
      } else {
        console.error('❌ Purchase failed:', error);
      }
      return false;
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      console.log('🔄 Restoring purchases...');

      const customerInfo = await Purchases.restorePurchases();

      const isPremium =
        customerInfo.entitlements.active[config.revenuecat.entitlementId] !==
        undefined;

      console.log(`✅ Restore complete! Premium: ${isPremium}`);

      return isPremium;
    } catch (error) {
      console.error('❌ Restore failed:', error);
      return false;
    }
  }

  async getAppUserId(): Promise<string> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.originalAppUserId;
    } catch (error) {
      console.error('❌ Get user ID failed:', error);
      return '';
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('❌ Get customer info failed:', error);
      return null;
    }
  }

  /**
   * Get offering by price point (for negotiated pricing)
   */
  async getOfferingByPrice(
    pricePoint: number,
  ): Promise<PurchasesOffering | null> {
    try {
      console.log(`🎯 Fetching offering for $${pricePoint}`);
      const offerings = await Purchases.getOfferings();

      // Map price to offering identifier (premium_monthly_20, premium_monthly_30, etc.)
      const offeringId = `premium_monthly_${pricePoint}`;
      const offering = offerings.all[offeringId];

      if (!offering) {
        console.warn(`⚠️ No offering found for ${offeringId}, using current`);
        return offerings.current;
      }

      console.log(`✅ Found offering: ${offeringId}`);
      return offering;
    } catch (error) {
      console.error('❌ Get offering by price failed:', error);
      return null;
    }
  }

  /**
   * Save user's negotiated price preference
   */
  async setNegotiatedPrice(price: number): Promise<void> {
    try {
      await Purchases.setAttributes({
        negotiated_price: String(price),
        negotiation_completed_at: new Date().toISOString(),
      });
      console.log(`💾 Saved negotiated price: $${price}`);
    } catch (error) {
      console.error('❌ Failed to save negotiated price:', error);
    }
  }
}

export const revenuecat = new RevenueCatService();
