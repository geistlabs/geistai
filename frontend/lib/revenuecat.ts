import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';

/**
 * RevenueCat service for managing subscriptions and purchases
 * Follows official RevenueCat Expo documentation:
 * https://www.revenuecat.com/docs/getting-started/installation/expo
 */

/**
 * Get RevenueCat API keys based on environment
 * - Development: Uses test keys by default
 * - Production: Uses production keys by default
 * - Can be overridden with EXPO_PUBLIC_REVENUECAT_USE_TEST_KEYS flag
 */
const getRevenueCatKeys = () => {
  const isProduction = !__DEV__;
  const forceTestKeys =
    process.env.EXPO_PUBLIC_REVENUECAT_USE_TEST_KEYS === 'true';
  const forceProdKeys =
    process.env.EXPO_PUBLIC_REVENUECAT_USE_PROD_KEYS === 'true';

  // Determine which environment keys to use
  // Default: test keys in dev, prod keys in production
  // Can be overridden with flags
  let useTestEnvironment = !isProduction;

  if (forceTestKeys) {
    useTestEnvironment = true;
  } else if (forceProdKeys) {
    useTestEnvironment = false;
  }

  if (useTestEnvironment) {
    // Use test/sandbox keys for development and testing
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY || '',
      google: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY || '',
      isTest: true,
    };
  } else {
    // Use production keys
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
      google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '',
      isTest: false,
    };
  }
};

const revenueCatKeys = getRevenueCatKeys();

/**
 * Initialize RevenueCat SDK
 * Call this once at app startup in your root component
 */
export async function initializeRevenueCat(): Promise<boolean> {
  try {
    // Set log level for debugging (use LOG_LEVEL.ERROR in production)
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

    // Configure RevenueCat based on platform
    if (Platform.OS === 'ios') {
      if (!revenueCatKeys.apple) {
        const envVarName = revenueCatKeys.isTest
          ? 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY'
          : 'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY';
        console.warn(
          `RevenueCat Apple API key not found. Set ${envVarName} (using ${revenueCatKeys.isTest ? 'test' : 'production'} environment)`,
        );
        return false;
      }
      Purchases.configure({ apiKey: revenueCatKeys.apple });

      if (__DEV__) {
        console.log(
          `RevenueCat initialized with ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'} Apple API key`,
        );
      }
    } else if (Platform.OS === 'android') {
      if (!revenueCatKeys.google) {
        const envVarName = revenueCatKeys.isTest
          ? 'EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY'
          : 'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY';
        console.warn(
          `RevenueCat Google API key not found. Set ${envVarName} (using ${revenueCatKeys.isTest ? 'test' : 'production'} environment)`,
        );
        return false;
      }
      Purchases.configure({ apiKey: revenueCatKeys.google });

      if (__DEV__) {
        console.log(
          `RevenueCat initialized with ${revenueCatKeys.isTest ? 'TEST' : 'PRODUCTION'} Google API key`,
        );
      }
    }
    return true;
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
    throw error;
  }
}

/**
 * Identify a user to RevenueCat
 * Use this when a user logs in or signs up
 * @param userId - Your app's user ID
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Error identifying user:', error);
    throw error;
  }
}

/**
 * Reset user identification
 * Use this when a user logs out
 */
export async function resetUser(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Error resetting user:', error);
    throw error;
  }
}

/**
 * Get current customer info
 * This contains subscription status and entitlements
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error fetching customer info:', error);
    throw error;
  }
}

/**
 * Check if user has active entitlement
 * @param entitlementIdentifier - The entitlement identifier from RevenueCat dashboard
 */
export async function hasActiveEntitlement(
  entitlementIdentifier: string,
): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (
      typeof customerInfo.entitlements.active[entitlementIdentifier] !==
      'undefined'
    );
  } catch (error) {
    console.error('Error checking entitlement:', error);
    return false;
  }
}

/**
 * Get available offerings (products available for purchase)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 * @param packageToPurchase - The package to purchase
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage,
): Promise<CustomerInfo> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error) {
    console.error('Error purchasing package:', error);
    throw error;
  }
}

/**
 * Restore purchases
 * Use this to restore purchases on a new device
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
}

/**
 * Get store products
 * Useful for displaying product information
 */
export async function getProducts(
  productIdentifiers: string[],
): Promise<PurchasesStoreProduct[]> {
  try {
    const products = await Purchases.getProducts(productIdentifiers);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Check if user is premium/subscribed
 * This is a convenience function that checks for a common entitlement
 * Adjust the entitlement identifier based on your RevenueCat setup
 */
export async function isPremium(
  entitlementIdentifier: string = 'premium',
): Promise<boolean> {
  return hasActiveEntitlement(entitlementIdentifier);
}
