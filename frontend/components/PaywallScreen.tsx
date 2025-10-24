import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { revenuecat } from '../lib/revenuecat';

interface PaywallScreenProps {
  onSuccess: () => void;
  selectedPrice?: number; // NEW: optional pre-selected price
}

export function PaywallScreen({
  onSuccess,
  selectedPrice,
}: PaywallScreenProps) {
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(
    null,
  );

  useEffect(() => {
    loadOffering();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrice]);

  const loadOffering = async () => {
    setLoading(true);

    let offering;

    // If a specific price was selected, get that offering
    if (selectedPrice) {
      offering = await revenuecat.getOfferingByPrice(selectedPrice);

      // Warn user if their negotiated price isn't available
      if (!offering) {
        Alert.alert(
          'Price Not Available',
          `The $${selectedPrice}/month plan is currently unavailable. Showing default pricing.`,
        );
        offering = await revenuecat.getOffering();
      }
    } else {
      // Otherwise get current/default offering
      offering = await revenuecat.getOffering();
    }

    if (offering?.availablePackages) {
      // Find monthly package
      const monthly = offering.availablePackages.find(
        pkg =>
          pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY',
      );

      setMonthlyPackage(monthly || offering.availablePackages[0]);
    } else {
      Alert.alert(
        'Configuration Error',
        'No subscription products available. Please try again later.',
      );
    }

    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!monthlyPackage) {
      Alert.alert('Error', 'No subscription package available');
      return;
    }

    setPurchasing(true);

    const success = await revenuecat.purchase(monthlyPackage);

    setPurchasing(false);

    if (success) {
      Alert.alert(
        '✅ Welcome to Premium!',
        'You now have unlimited access to Geist AI.',
        [{ text: 'Get Started', onPress: onSuccess }],
      );
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);

    const success = await revenuecat.restorePurchases();

    setPurchasing(false);

    if (success) {
      Alert.alert(
        '✅ Purchases Restored!',
        'Your premium access has been restored.',
        [{ text: 'Continue', onPress: onSuccess }],
      );
    } else {
      Alert.alert(
        'No Purchases Found',
        'You have no previous purchases to restore. If you believe this is an error, please contact support.',
      );
    }
  };

  if (loading) {
    return (
      <View className='flex-1 items-center justify-center bg-white'>
        <ActivityIndicator size='large' color='#3b82f6' />
        <Text className='mt-4 text-gray-600'>Loading subscription...</Text>
      </View>
    );
  }

  return (
    <ScrollView className='flex-1 bg-white'>
      <View className='flex-1 px-6 py-12'>
        {/* Header */}
        <View className='items-center mb-8'>
          <Text className='text-5xl mb-4'>✨</Text>
          <Text className='text-4xl font-bold mb-3 text-center'>
            Geist AI Premium
          </Text>
          <Text className='text-lg text-gray-600 text-center'>
            Unlock unlimited AI conversations
          </Text>
          {selectedPrice && (
            <View className='mt-4 bg-green-100 border border-green-300 rounded-lg px-4 py-2'>
              <Text className='text-green-800 font-semibold text-center'>
                🎯 Your personalized price: ${selectedPrice}/month
              </Text>
            </View>
          )}
        </View>

        {/* Features */}
        <View className='mb-8'>
          {[
            {
              icon: '💬',
              title: 'Unlimited Messages',
              desc: 'No daily limits',
            },
            {
              icon: '🚀',
              title: 'Advanced AI Models',
              desc: 'GPT-4 and beyond',
            },
            {
              icon: '⚡',
              title: 'Priority Processing',
              desc: 'Faster responses',
            },
            { icon: '🎯', title: 'Premium Support', desc: '24/7 assistance' },
          ].map((feature, index) => (
            <View key={index} className='flex-row items-start mb-5'>
              <Text className='text-3xl mr-4'>{feature.icon}</Text>
              <View className='flex-1'>
                <Text className='text-lg font-semibold mb-1'>
                  {feature.title}
                </Text>
                <Text className='text-gray-600'>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price Card */}
        {monthlyPackage && (
          <View className='bg-blue-50 rounded-3xl p-8 mb-6 border-2 border-blue-200'>
            <Text className='text-4xl font-bold text-center mb-2'>
              {monthlyPackage.product.priceString}
            </Text>
            <Text className='text-center text-gray-700 text-lg font-medium'>
              per month
            </Text>
            <Text className='text-center text-gray-600 text-sm mt-3'>
              Cancel anytime • No commitments
            </Text>
          </View>
        )}

        {/* Subscribe Button */}
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={purchasing || !monthlyPackage}
          className={`py-5 rounded-2xl mb-4 shadow-lg ${
            purchasing || !monthlyPackage ? 'bg-gray-300' : 'bg-blue-600'
          }`}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {purchasing ? (
            <ActivityIndicator color='white' />
          ) : (
            <Text className='text-white text-xl font-bold text-center'>
              Start Premium Now
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore Button */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={purchasing}
          className='py-3'
        >
          <Text className='text-blue-600 text-center font-semibold'>
            Restore Previous Purchase
          </Text>
        </TouchableOpacity>

        {/* Legal Text */}
        <View className='mt-8 pt-6 border-t border-gray-200'>
          <Text className='text-xs text-gray-500 text-center leading-5'>
            Payment will be charged to your Apple ID account at confirmation of
            purchase. Subscription automatically renews unless canceled at least
            24 hours before the end of the current period. Your account will be
            charged for renewal within 24 hours prior to the end of the current
            period. You can manage and cancel your subscriptions in your App
            Store account settings.
          </Text>

          <View className='flex-row justify-center mt-4 space-x-4'>
            <TouchableOpacity>
              <Text className='text-xs text-blue-600 underline'>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text className='text-xs text-gray-400'>•</Text>
            <TouchableOpacity>
              <Text className='text-xs text-blue-600 underline'>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
