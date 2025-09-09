import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Animated, Dimensions, Modal } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(288, SCREEN_WIDTH * 0.85); // w-72 max-w-[85%]

interface ChatItem {
  id: number;
  title: string;
  updated_at: number;
  pinned: number;
  archived: number;
}

interface ChatDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  onChatSelect: (chatId: number) => void;
  activeChatId?: number;
  onNewChat: () => void;
  chats: ChatItem[];
  onDeleteChat: (chatId: number) => void;
}

export function ChatDrawer({
  isVisible,
  onClose,
  onChatSelect,
  activeChatId,
  onNewChat,
  chats,
  onDeleteChat,
}: ChatDrawerProps) {
  // Animation for drawer slide
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, translateX]);

  const handleChatPress = (chatId: number) => {
    // Close drawer first, then select chat after animation completes
    onClose();
    // Wait for the close animation to complete before selecting chat
    setTimeout(() => {
      onChatSelect(chatId);
    }, 200);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      onPress={() => handleChatPress(item.id)}
      className={`p-4 border-b border-gray-100 ${
        activeChatId === item.id ? 'bg-blue-50' : ''
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text 
            className="font-medium text-gray-900 mb-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title || 'New Chat'}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatDate(item.updated_at)}
          </Text>
        </View>
        {item.pinned === 1 && (
          <View className="w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row">
        {/* Drawer */}
        <Animated.View
          style={{
            transform: [{ translateX }],
            width: DRAWER_WIDTH,
          }}
          className="bg-white h-full shadow-lg"
        >
          {/* Header */}
          <View className="p-4 border-b border-gray-200 bg-gray-50">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900">Chats</Text>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* New Chat Button */}
            <TouchableOpacity
              onPress={() => {
                onClose();
                setTimeout(() => onNewChat(), 200);
              }}
              className="bg-blue-500 rounded-lg p-3"
            >
              <Text className="text-white text-center font-medium">New Chat</Text>
            </TouchableOpacity>
          </View>

          {/* Chat List */}
          <View className="flex-1">
            {chats.length > 0 ? (
              <FlatList
                data={chats}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderChatItem}
                className="flex-1"
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center p-6">
                <Text className="text-gray-500 text-center">No chats yet</Text>
                <Text className="text-gray-400 text-sm text-center mt-2">
                  Start a conversation to see your chats here
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Backdrop */}
        <TouchableOpacity
          onPress={onClose}
          className="flex-1 bg-black/30"
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
}