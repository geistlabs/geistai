/**
 * NegotiationChat component - Chat interface for pricing negotiations
 * Uses the specialized pricing agent for subscription discussions
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useChatWithStorage } from '../hooks/useChatWithStorage';
import { usePremium } from '../hooks/usePremium';

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

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
      </ScrollView>

      {/* Input */}
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
    </View>
  );
}

export default NegotiationChat;
