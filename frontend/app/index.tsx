import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ChatDrawer from '../components/chat/ChatDrawer';
import { InputBar } from '../components/chat/InputBar';
import { LoadingIndicator } from '../components/chat/LoadingIndicator';
import { MessageBubble } from '../components/chat/MessageBubble';
import HamburgerIcon from '../components/HamburgerIcon';
import { NetworkStatus } from '../components/NetworkStatus';
import { VoiceInputModal } from '../components/VoiceInputModal';
import '../global.css';
import { useChatWithStorage } from '../hooks/useChatWithStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(288, SCREEN_WIDTH * 0.85);

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [input, setInput] = useState('');
  const [currentChatId, setCurrentChatId] = useState<number | undefined>(
    undefined,
  );
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);

  // Animation for sliding the app content
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    currentChat,
    createNewChat,
    storageError,
    chatApi,
  } = useChatWithStorage({ chatId: currentChatId });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    }
    if (storageError) {
      Alert.alert('Storage Error', storageError);
    }
  }, [error, storageError]);

  const handleSend = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }
    if (!input.trim() || isStreaming) return;

    // If no chat is active, create a new one FIRST
    let chatId = currentChatId;
    if (!chatId) {
      try {
        chatId = await createNewChat();
        setCurrentChatId(chatId);

        // Wait a frame for React to update the hook
        await new Promise(resolve => setTimeout(resolve, 0));
      } catch (err) {
        console.error('Failed to create new chat:', err);
        Alert.alert('Error', 'Failed to create new chat');
        return;
      }
    }

    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleInterrupt = () => {
    stopStreaming();
  };

  const handleNewChat = async () => {
    try {
      // Auto-interrupt any ongoing streaming
      if (isStreaming) {
        stopStreaming();
      }

      const newChatId = await createNewChat();
      setCurrentChatId(newChatId);
      clearMessages();
      setIsDrawerVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to create new chat');
    }
  };

  const handleChatSelect = (chatId: number) => {
    setCurrentChatId(chatId);
    // Drawer closing is now handled by ChatDrawer component
  };

  // Handle drawer animation
  useEffect(() => {
    if (isDrawerVisible) {
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      // Use a shorter duration for closing to make it more responsive
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isDrawerVisible]);

  const handleDrawerOpen = () => {
    setIsDrawerVisible(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerVisible(false);
  };

  const handleVoiceInput = () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }
    setIsVoiceModalVisible(true);
  };

  const handleVoiceTranscriptionComplete = async (text: string) => {
    if (!text.trim()) return;

    // Set the transcribed text in the input field
    setInput(text);

    // If no chat is active, create a new one
    let chatId = currentChatId;
    if (!chatId) {
      try {
        chatId = await createNewChat();
        setCurrentChatId(chatId);
        await new Promise(resolve => setTimeout(resolve, 0));
      } catch (err) {
        console.error('Failed to create new chat:', err);
        Alert.alert('Error', 'Failed to create new chat');
        return;
      }
    }

    // Send the transcribed message
    await sendMessage(text);
  };

  return (
    <>
      {/* Main App Content */}
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: slideAnim }],
        }}
      >
        <SafeAreaView className='flex-1 bg-white'>
          <KeyboardAvoidingView
            className='flex-1'
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Network Status */}
            {!isConnected && (
              <NetworkStatus isOnline={isConnected} position='top' />
            )}

            {/* Header */}
            <View className='relative border-b border-gray-200 px-4 py-3'>
              <View className='flex-row items-center'>
                {/* Left side - Hamburger Menu */}
                <TouchableOpacity
                  onPress={handleDrawerOpen}
                  className='-ml-2 mr-2 p-2'
                >
                  <HamburgerIcon size={20} color='#374151' />
                </TouchableOpacity>

                {/* Center - Title */}
                <View className='flex-row items-center'>
                  <Text className='text-lg font-medium text-black'>Geist</Text>
                </View>

                {/* Right side - New Chat Button */}
                <View className='ml-auto'>
                  <TouchableOpacity
                    onPress={handleNewChat}
                    className='px-3 py-1.5 bg-gray-100 rounded-lg'
                  >
                    <Text className='text-sm text-gray-700'>New Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Messages List */}
            <View className='flex-1 pb-2'>
              {isLoading && messages.length === 0 ? (
                <View className='flex-1 items-center justify-center p-8'>
                  <LoadingIndicator size='medium' />
                  {storageError && (
                    <Text className='text-red-500 text-sm text-center mt-2'>
                      {storageError}
                    </Text>
                  )}
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages.filter(message => {
                    const isValid =
                      message &&
                      typeof message === 'object' &&
                      message.role &&
                      typeof message.content === 'string'; // Allow empty strings for streaming assistant messages
                    if (!isValid) {
                      console.warn(
                        '[ChatScreen] Filtering out invalid message:',
                        message,
                      );
                    }
                    return isValid;
                  })}
                  keyExtractor={(item, index) => {
                    try {
                      return (
                        item?.id ||
                        item?.timestamp?.toString() ||
                        `message-${index}`
                      );
                    } catch (err) {
                      console.error(
                        '[ChatScreen] Error in keyExtractor:',
                        err,
                        item,
                      );
                      return `error-${index}`;
                    }
                  }}
                  renderItem={({ item, index }) => {
                    try {
                      return (
                        <MessageBubble
                          message={item}
                          allMessages={messages}
                          messageIndex={index}
                        />
                      );
                    } catch (err) {
                      console.error(
                        '[ChatScreen] Error rendering message:',
                        err,
                        item,
                      );
                      return null;
                    }
                  }}
                  contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                  className='flex-1 bg-white'
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                />
              )}
            </View>

            {/* Error with Retry */}
            {error && !isStreaming && (
              <TouchableOpacity
                onPress={retryLastMessage}
                className='mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg'
              >
                <Text className='text-red-600 text-sm text-center'>
                  Failed to send. Tap to retry.
                </Text>
              </TouchableOpacity>
            )}

            {/* Input Bar */}
            <InputBar
              value={input}
              onChangeText={setInput}
              onSend={handleSend}
              onInterrupt={handleInterrupt}
              onVoiceInput={handleVoiceInput}
              disabled={isLoading || !isConnected}
              isStreaming={isStreaming}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Overlay for main content when drawer is open */}
        {isDrawerVisible && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.01)',
              zIndex: 5,
            }}
          />
        )}
      </Animated.View>

      {/* Chat Drawer */}
      <ChatDrawer
        isVisible={isDrawerVisible}
        onClose={handleDrawerClose}
        onChatSelect={handleChatSelect}
        activeChatId={currentChatId}
        onNewChat={handleNewChat}
      />

      {/* Voice Input Modal */}
      <VoiceInputModal
        visible={isVoiceModalVisible}
        onClose={() => setIsVoiceModalVisible(false)}
        onTranscriptionComplete={handleVoiceTranscriptionComplete}
        chatAPI={chatApi}
        language='en'
      />
    </>
  );
}
