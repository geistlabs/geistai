import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatWithStorage } from '../hooks/useChatWithStorage';
import { EnhancedMessageBubble } from './chat/EnhancedMessageBubble';
import { InputBar } from './chat/InputBar';
import { LoadingIndicator } from './chat/LoadingIndicator';

interface NegotiationChatProps {
  onPriceAgreed: (price: number) => void;
  onSkip: () => void;
}

export function NegotiationChat({
  onPriceAgreed,
  onSkip,
}: NegotiationChatProps) {
  const {
    enhancedMessages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  } = useChatWithStorage({ endpoint: 'negotiate' });

  const [showPriceConfirm, setShowPriceConfirm] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const flatListRef = React.useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (enhancedMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [enhancedMessages.length]);

  // Check for agreed price in latest message
  useEffect(() => {
    if (enhancedMessages.length === 0) return;

    const lastMsg = enhancedMessages[enhancedMessages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg?.content) {
      // Look for ✅ AGREED_PRICE: $XX.XX pattern
      const priceMatch = lastMsg.content.match(
        /✅\s*AGREED_PRICE:\s*\$(\d+\.\d+)/,
      );
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        setAgreedPrice(price);
        setShowPriceConfirm(true);
      }
    }
  }, [enhancedMessages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    await sendMessage(text);
    setInputValue('');
  };

  // Show price confirmation screen
  if (showPriceConfirm && agreedPrice) {
    return (
      <SafeAreaView className='flex-1 bg-white justify-center items-center px-6'>
        <View className='bg-green-50 border-2 border-green-400 rounded-xl p-8 items-center'>
          <Text className='text-5xl mb-4'>✅</Text>
          <Text className='text-2xl font-bold text-green-700 mb-2'>Deal!</Text>
          <Text className='text-lg text-gray-600 mb-6 text-center'>
            We've agreed on a price of:
          </Text>
          <Text className='text-5xl font-bold text-green-600 mb-8'>
            ${agreedPrice.toFixed(2)}
          </Text>
          <Text className='text-sm text-gray-500 mb-6 text-center'>
            per month
          </Text>

          <TouchableOpacity
            onPress={() => onPriceAgreed(agreedPrice)}
            className='w-full bg-green-600 px-6 py-4 rounded-lg mb-3'
          >
            <Text className='text-white font-bold text-center text-lg'>
              Proceed to Payment
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setShowPriceConfirm(false);
              setAgreedPrice(null);
              clearMessages();
            }}
            className='w-full bg-gray-200 px-6 py-3 rounded-lg'
          >
            <Text className='text-gray-700 font-bold text-center'>
              Start Over
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <KeyboardAvoidingView
        className='flex-1'
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className='border-b border-gray-200 px-4 py-3'>
          <Text className='text-lg font-bold text-gray-800'>
            💰 Negotiate Your Price
          </Text>
          <Text className='text-sm text-gray-600 mt-1'>
            Let's find a price that works for you
          </Text>
        </View>

        {/* Messages */}
        <View className='flex-1'>
          {isLoading && enhancedMessages.length === 0 ? (
            <View className='flex-1 justify-center items-center'>
              <LoadingIndicator size='medium' />
              <Text className='mt-4 text-gray-600'>
                Starting negotiation...
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={enhancedMessages.filter(
                msg =>
                  msg &&
                  typeof msg === 'object' &&
                  msg.role &&
                  typeof msg.content === 'string',
              )}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => (
                <EnhancedMessageBubble
                  message={item}
                  allMessages={enhancedMessages}
                  messageIndex={index}
                />
              )}
              contentContainerStyle={{ paddingVertical: 12 }}
            />
          )}
        </View>

        {/* Error message */}
        {error && (
          <View className='bg-red-50 border-l-4 border-red-500 px-4 py-3'>
            <Text className='text-red-700 text-sm'>{error.message}</Text>
          </View>
        )}

        {/* Input area */}
        <View className='border-t border-gray-200 px-4 py-3'>
          <InputBar
            value={inputValue}
            onChangeText={setInputValue}
            onSend={() => handleSend(inputValue)}
            isLoading={isStreaming}
            placeholder='Tell me about your needs...'
          />

          {/* Skip button */}
          <TouchableOpacity onPress={onSkip} className='mt-3 py-2'>
            <Text className='text-center text-gray-500 text-sm'>
              Skip negotiation
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
