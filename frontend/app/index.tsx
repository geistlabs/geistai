import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChatDrawer from '../components/chat/ChatDrawer';
import { EnhancedMessageBubble } from '../components/chat/EnhancedMessageBubble';
import { InputBar } from '../components/chat/InputBar';
import { LoadingIndicator } from '../components/chat/LoadingIndicator';
import HamburgerIcon from '../components/HamburgerIcon';
import { NetworkStatus } from '../components/NetworkStatus';
import '../global.css';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { useChatWithStorage } from '../hooks/useChatWithStorage';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(288, SCREEN_WIDTH * 0.85);

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected } = useNetworkStatus();
  const [input, setInput] = useState('');
  const [currentChatId, setCurrentChatId] = useState<number | undefined>(
    undefined,
  );
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio recording hook
  const recording = useAudioRecording();

  // Animation for sliding the app content
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
    enhancedMessages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    createNewChat,
    storageError,
    chatApi,
    loadChat,
  } = useChatWithStorage({ chatId: currentChatId });

  useEffect(() => {
    if (enhancedMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [enhancedMessages.length]);

  useEffect(() => {
    if (currentChatId) {
      setTimeout(() => {
        loadChat(currentChatId);
      }, 200);
    }
  }, [currentChatId]);

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

  const handleStoragePress = () => {
    router.push('/storage');
  };

  const handleVoiceInput = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }

    try {
      setIsRecording(true);
      await recording.startRecording();
    } catch (error) {
      setIsRecording(false);
      Alert.alert('Recording Error', 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await recording.stopRecording();
      setIsRecording(false);

      if (uri) {
        setIsTranscribing(true);
        const result = await chatApi.transcribeAudio(uri); // Use automatic language detection

        if (result.success && result.text.trim()) {
          await handleVoiceTranscriptionComplete(result.text.trim());
        } else {
          Alert.alert(
            'Transcription Error',
            result.error || 'No speech detected',
          );
        }
      }
    } catch (error) {
      Alert.alert('Recording Error', 'Failed to process recording');
    } finally {
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = async () => {
    try {
      await recording.stopRecording();
    } catch (error) {
      // Ignore error when canceling
    } finally {
      setIsRecording(false);
      setIsTranscribing(false);
    }
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
        Alert.alert('Error', 'Failed to create new chat');
        return;
      }
    }
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

                {/* Right side - Buttons */}
                <View className='ml-auto flex-row space-x-2'>
                  <TouchableOpacity
                    onPress={handleStoragePress}
                    className='px-3 py-1.5 bg-blue-100 rounded-lg'
                  >
                    <Text className='text-sm text-blue-700'>Storage</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push('/memory')}
                    className='px-3 py-1.5 bg-green-100 rounded-lg'
                  >
                    <Text className='text-sm text-green-700'>Memory</Text>
                  </TouchableOpacity>
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
              {isLoading && enhancedMessages.length === 0 ? (
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
                  data={enhancedMessages.filter(message => {
                    const isValid =
                      message &&
                      typeof message === 'object' &&
                      message.role &&
                      typeof message.content === 'string'; // Allow empty strings for streaming assistant messages
                    if (!isValid) {
                      // Invalid message filtered out
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
                      return `error-${index}`;
                    }
                  }}
                  renderItem={({ item, index }) => {
                    try {
                      return (
                        <EnhancedMessageBubble
                          message={item}
                          allMessages={enhancedMessages}
                          messageIndex={index}
                        />
                      );
                    } catch (err) {
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
              disabled={isLoading || !isConnected || isTranscribing}
              isStreaming={isStreaming}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              onStopRecording={handleStopRecording}
              onCancelRecording={handleCancelRecording}
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
    </>
  );
}
