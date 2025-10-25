/**
 * NegotiationChat component - Chat interface for pricing negotiations
 * Uses the specialized pricing agent for subscription discussions
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatWithStorage } from '../hooks/useChatWithStorage';
import { usePremium } from '../hooks/usePremium';
import { revenuecat } from '../lib/revenuecat';

interface NegotiationChatProps {
  onClose?: () => void;
}

export function NegotiationChat({ onClose }: NegotiationChatProps) {
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    isPremium,
    isLoading: premiumLoading,
    togglePremiumStatus,
  } = usePremium();

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendNegotiationMessage,
    stopStreaming,
    negotiationResult,
  } = useChatWithStorage({
    chatId: 999999, // Use a special chat ID for negotiations
    onStreamStart: () => {
      console.log('🔄 [Negotiation] Stream started');
    },
    onStreamEnd: () => {
      console.log('✅ [Negotiation] Stream ended');
      // Auto-scroll to bottom when new message arrives
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onTokenCount: count => {
      console.log(`📊 [Negotiation] Token count: ${count}`);
    },
  });

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || isStreaming) return;

    const message = inputText.trim();
    setInputText('');

    try {
      await sendNegotiationMessage(message);
    } catch (err) {
      console.error('❌ [Negotiation] Failed to send message:', err);
    }
  };

  const handleStopStreaming = () => {
    stopStreaming();
  };

  const handleUpgradeNow = async () => {
    if (!negotiationResult) return;

    try {
      console.log('💰 [Negotiation] Starting purchase for:', negotiationResult);

      // Get RevenueCat offerings
      const offerings = await revenuecat.getOfferings();

      if (!offerings.current) {
        Alert.alert('Error', 'No subscription packages available');
        return;
      }

      // Find the package matching the negotiated price
      const packageId = negotiationResult.package_id; // e.g., "premium_monthly_30"
      const package_ = offerings.current.getPackage(packageId);

      if (!package_) {
        Alert.alert('Error', `Package ${packageId} not found in offerings`);
        console.error(
          'Available packages:',
          offerings.current.availablePackages.map(p => p.identifier),
        );
        return;
      }

      console.log(
        '💰 [Negotiation] Found package:',
        package_.identifier,
        'Price:',
        package_.price,
      );

      // Initiate purchase
      const purchase = await revenuecat.purchasePackage(package_);

      // Check if purchase was successful
      if (purchase.customerInfo.entitlements.active['premium']) {
        Alert.alert(
          'Success!',
          `Welcome to GeistAI Premium at $${negotiationResult.final_price.toFixed(2)}/month!`,
          [{ text: 'Continue', onPress: () => onClose?.() }],
        );
      } else {
        Alert.alert('Purchase Failed', 'Please try again');
      }
    } catch (err) {
      console.error('❌ [Negotiation] Purchase error:', err);
      Alert.alert(
        'Purchase Error',
        'Failed to complete purchase. Please try again.',
      );
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Debug negotiation result changes
  useEffect(() => {
    console.log('🔍 [DEBUG] NegotiationChat negotiationResult changed:', negotiationResult);
  }, [negotiationResult]);

  if (premiumLoading) {
    return (
      <View className='flex-1 justify-center items-center p-4'>
        <ActivityIndicator size='large' color='#3B82F6' />
        <Text className='text-gray-600 mt-2'>Loading negotiation chat...</Text>
      </View>
    );
  }

  return (
    <View className='flex-1 bg-white'>
      {/* Header */}
      <View className='bg-blue-500 px-4 py-3 flex-row items-center justify-between'>
        <Text className='text-white font-semibold text-lg'>
          💬 Pricing Negotiation
        </Text>
        <View className='flex-row items-center space-x-2'>
          {/* Development Toggle Button */}
          <TouchableOpacity
            onPress={togglePremiumStatus}
            className='bg-white/20 px-3 py-1 rounded-full'
          >
            <Text className='text-white text-xs font-medium'>
              🔧 Toggle Premium
            </Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} className='p-1'>
              <Text className='text-white text-xl'>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        className='flex-1 px-4 py-2'
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View className='flex-1 justify-center items-center py-8'>
            <Text className='text-gray-500 text-center text-lg mb-2'>
              👋 Welcome to Pricing Negotiation
            </Text>
            <Text className='text-gray-400 text-center'>
              I'm here to help you find the perfect GeistAI subscription plan.
              Tell me about your needs and budget!
            </Text>
          </View>
        )}

        {messages.map((message, index) => (
          <View
            key={`${message.id || 'msg'}-${index}-${message.timestamp || Date.now()}`}
            className={`mb-4 ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <View
              className={`max-w-[80%] px-4 py-3 rounded-lg ${
                message.role === 'user' ? 'bg-blue-500' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm ${
                  message.role === 'user' ? 'text-white' : 'text-gray-800'
                }`}
              >
                {message.content}
              </Text>
              {message.role === 'assistant' &&
                isStreaming &&
                index === messages.length - 1 && (
                  <View className='flex-row items-center mt-2'>
                    <ActivityIndicator size='small' color='#3B82F6' />
                    <Text className='text-gray-500 text-xs ml-2'>
                      AI is thinking...
                    </Text>
                  </View>
                )}
            </View>
          </View>
        ))}

        {error && (
          <View className='bg-red-50 border border-red-200 rounded-lg p-3 mb-4'>
            <Text className='text-red-600 text-sm'>Error: {error.message}</Text>
          </View>
        )}

        {/* Negotiation Result Paywall */}
        {negotiationResult && (
          <View className='mx-4 mb-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200'>
            <Text className='text-sm font-semibold text-blue-900 mb-2'>
              ✅ Deal Finalized!
            </Text>

            <View className='mb-3'>
              <Text className='text-xs text-blue-700 mb-1'>
                Your Negotiated Price
              </Text>
              <Text className='text-3xl font-bold text-blue-900'>
                ${negotiationResult.final_price.toFixed(2)}
              </Text>
              <Text className='text-xs text-blue-600 mt-1'>per month</Text>
            </View>

            <Text className='text-sm text-blue-800 mb-3 italic'>
              "{negotiationResult.negotiation_summary}"
            </Text>

            <TouchableOpacity
              onPress={handleUpgradeNow}
              className='bg-blue-600 px-4 py-3 rounded-lg'
            >
              <Text className='text-white text-center font-semibold'>
                Upgrade Now at ${negotiationResult.final_price.toFixed(2)}/mo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Input - Only show if negotiation is not complete */}
      {!negotiationResult && (
        <View className='border-t border-gray-200 px-4 py-3'>
          <View className='flex-row items-center space-x-2'>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder='Ask about pricing, features, or your needs...'
              className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm'
              multiline
              maxLength={500}
              editable={!isLoading && !isStreaming}
            />
            {isStreaming ? (
              <TouchableOpacity
                onPress={handleStopStreaming}
                className='bg-red-500 px-4 py-2 rounded-lg'
              >
                <Text className='text-white text-sm font-medium'>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                className={`px-4 py-2 rounded-lg ${
                  !inputText.trim() || isLoading ? 'bg-gray-300' : 'bg-blue-500'
                }`}
              >
                <Text className='text-white text-sm font-medium'>Send</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className='text-gray-400 text-xs mt-1 text-center'>
            {inputText.length}/500 characters
          </Text>
        </View>
      )}
    </View>
  );
}

export default NegotiationChat;
