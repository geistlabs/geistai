import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useProducts } from '@/hooks/useRevenueCatQueries';

/**
 * Example component demonstrating how to use RevenueCat with TanStack Query
 * This shows the main useRevenueCat hook and additional query hooks
 */
export function RevenueCatExample() {
  const {
    customerInfo,
    offerings,
    isLoading,
    isPurchasing,
    isSubscribed,
    error,
    purchase,
    restore,
    identify,
    reset,
    refresh,
  } = useRevenueCat('premium', 'user123'); // Replace with actual user ID

  // Example of using additional query hooks
  const { data: products } = useProducts([
    'premium_monthly_20',
    'premium_monthly_30',
  ]);

  const handlePurchase = async (packageToPurchase: any) => {
    try {
      await purchase(packageToPurchase);
      Alert.alert('Success', 'Purchase completed successfully!');
    } catch (err) {
      Alert.alert('Error', `Purchase failed: ${err}`);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      Alert.alert('Success', 'Purchases restored successfully!');
    } catch (err) {
      Alert.alert('Error', `Restore failed: ${err}`);
    }
  };

  const handleIdentify = async () => {
    try {
      await identify('new-user-id');
      Alert.alert('Success', 'User identified successfully!');
    } catch (err) {
      Alert.alert('Error', `Identify failed: ${err}`);
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      Alert.alert('Success', 'User reset successfully!');
    } catch (err) {
      Alert.alert('Error', `Reset failed: ${err}`);
    }
  };

  if (isLoading) {
    return (
      <View className='flex-1 items-center justify-center p-4'>
        <ActivityIndicator size='large' />
        <Text className='mt-2 text-gray-600'>Loading subscription data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className='flex-1 items-center justify-center p-4'>
        <Text className='text-red-600 mb-4'>Error: {error}</Text>
        <TouchableOpacity
          onPress={refresh}
          className='bg-blue-500 px-4 py-2 rounded'
        >
          <Text className='text-white'>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className='flex-1 p-4'>
      <Text className='text-2xl font-bold mb-4'>RevenueCat Example</Text>

      {/* Subscription Status */}
      <View className='mb-6'>
        <Text className='text-lg font-semibold mb-2'>Subscription Status</Text>
        <Text
          className={`text-lg ${isSubscribed ? 'text-green-600' : 'text-red-600'}`}
        >
          {isSubscribed ? 'Premium Active' : 'Not Subscribed'}
        </Text>
      </View>

      {/* Customer Info */}
      {customerInfo && (
        <View className='mb-6'>
          <Text className='text-lg font-semibold mb-2'>Customer Info</Text>
          <Text className='text-gray-600'>
            Original App User ID: {customerInfo.originalAppUserId}
          </Text>
          <Text className='text-gray-600'>
            Active Subscriptions:{' '}
            {Object.keys(customerInfo.entitlements.active).length}
          </Text>
        </View>
      )}

      {/* Available Packages */}
      {offerings && (
        <View className='mb-6'>
          <Text className='text-lg font-semibold mb-2'>Available Packages</Text>
          {offerings.availablePackages.map(pkg => (
            <TouchableOpacity
              key={pkg.identifier}
              onPress={() => handlePurchase(pkg)}
              disabled={isPurchasing}
              className='bg-blue-500 p-4 rounded mb-2'
            >
              <Text className='text-white text-center font-semibold'>
                {pkg.product.title} - {pkg.product.priceString}
                {isPurchasing && ' (Processing...)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Additional Products */}
      {products && (
        <View className='mb-6'>
          <Text className='text-lg font-semibold mb-2'>
            Additional Products
          </Text>
          {products.map(product => (
            <View
              key={product.identifier}
              className='bg-gray-100 p-3 rounded mb-2'
            >
              <Text className='font-semibold'>{product.title}</Text>
              <Text className='text-gray-600'>{product.priceString}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View className='space-y-2'>
        <TouchableOpacity
          onPress={handleRestore}
          disabled={isPurchasing}
          className='bg-green-500 p-4 rounded'
        >
          <Text className='text-white text-center font-semibold'>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleIdentify}
          className='bg-purple-500 p-4 rounded'
        >
          <Text className='text-white text-center font-semibold'>
            Identify New User
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleReset}
          className='bg-red-500 p-4 rounded'
        >
          <Text className='text-white text-center font-semibold'>
            Reset User
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={refresh} className='bg-gray-500 p-4 rounded'>
          <Text className='text-white text-center font-semibold'>
            Refresh Data
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
