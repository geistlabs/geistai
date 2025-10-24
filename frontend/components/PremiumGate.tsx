import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { usePremium } from '../hooks/usePremium';
import { revenuecat } from '../lib/revenuecat';

import { NegotiationChat } from './NegotiationChat';
import { PaywallScreen } from './PaywallScreen';

interface PremiumGateProps {
  children: React.ReactNode;
}

export function PremiumGate({ children }: PremiumGateProps) {
  const { isPremium, isLoading } = usePremium();
  const [showNegotiation, setShowNegotiation] = useState(true);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | null>(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const skipped = await AsyncStorage.getItem('negotiation_skipped');
        if (skipped === 'true') {
          setShowNegotiation(false);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load negotiation preference:', error);
      } finally {
        setIsLoadingPreference(false);
      }
    };
    loadPreference();
  }, []);

  // When premium status changes, reset negotiation flow
  useEffect(() => {
    if (isPremium) {
      // User is premium - no need to show negotiation
      return;
    }

    // User lost premium - reset negotiation to show form again
    const resetNegotiation = async () => {
      try {
        // Clear the "skipped" flag so negotiation shows again
        await AsyncStorage.removeItem('negotiation_skipped');
        setShowNegotiation(true);
        setNegotiatedPrice(null);
        // eslint-disable-next-line no-console
        console.log('🔄 Premium lost - resetting negotiation flow');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to reset negotiation:', error);
      }
    };

    resetNegotiation();
  }, [isPremium]);

  // Show loading state
  if (isLoading || isLoadingPreference) {
    return (
      <View className='flex-1 items-center justify-center bg-white'>
        <ActivityIndicator size='large' color='#3b82f6' />
        <Text className='mt-4 text-gray-600'>Checking subscription...</Text>
      </View>
    );
  }

  // User is premium - show app
  if (isPremium) {
    return <>{children}</>;
  }

  // Show negotiation first
  if (showNegotiation && !negotiatedPrice) {
    return (
      <NegotiationChat
        onPriceAgreed={async price => {
          await revenuecat.setNegotiatedPrice(price);
          setNegotiatedPrice(price);
          setShowNegotiation(false);
        }}
        onSkip={async () => {
          try {
            await AsyncStorage.setItem('negotiation_skipped', 'true');
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save negotiation preference:', error);
          }
          setShowNegotiation(false);
        }}
      />
    );
  }

  // Show paywall with negotiated (or default) price
  return (
    <PaywallScreen
      selectedPrice={negotiatedPrice ?? undefined}
      onSuccess={() => router.replace('/')}
    />
  );
}
