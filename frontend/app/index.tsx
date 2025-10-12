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
import { DebugPanel } from '../components/chat/DebugPanel';
import { InputBar } from '../components/chat/InputBar';
import { LoadingIndicator } from '../components/chat/LoadingIndicator';
import { MessageBubble } from '../components/chat/MessageBubble';
import HamburgerIcon from '../components/HamburgerIcon';
import { NetworkStatus } from '../components/NetworkStatus';
import '../global.css';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { useChatDebug } from '../hooks/useChatDebug';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(288, SCREEN_WIDTH * 0.85);

export default function ChatScreenDebug() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [input, setInput] = useState('');
  const [currentChatId, setCurrentChatId] = useState<number | undefined>(
    undefined,
  );
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);

  // Audio recording hook
  const recording = useAudioRecording();

  // Animation for sliding the app content
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    debugInfo,
    chatApi,
  } = useChatDebug({
    onStreamStart: () => {
      console.log('🚀 [ChatScreen] Stream started');
    },
    onStreamEnd: () => {
      console.log('✅ [ChatScreen] Stream ended');
    },
    onError: error => {
      console.error('❌ [ChatScreen] Stream error:', error);
      Alert.alert('Error', error.message);
    },
    onDebugInfo: info => {
      console.log('🔍 [ChatScreen] Debug info received:', info);
    },
    onTokenCount: count => {
      if (count % 100 === 0) {
        console.log('📊 [ChatScreen] Token count:', count);
      }
    },
    debugMode: true,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Debug log for button state
  useEffect(() => {
    console.log('🎨 [ChatScreen] UI State:', {
      input: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
      inputLength: input.length,
      hasText: !!input.trim(),
      isLoading,
      isStreaming,
      buttonShouldBeEnabled: !!input.trim() && !isLoading && !isStreaming,
    });
  }, [input, isLoading, isStreaming]);

  // Handle drawer animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isDrawerVisible ? DRAWER_WIDTH : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isDrawerVisible, slideAnim]);

  const handleSendMessage = async () => {
    console.log('🔘 [ChatScreen] Send button clicked:', {
      hasInput: !!input.trim(),
      inputLength: input.length,
      isLoading,
      isStreaming,
    });

    if (!input.trim()) {
      console.log('⚠️ [ChatScreen] Send blocked: no input');
      return;
    }

    if (isLoading || isStreaming) {
      console.log('⚠️ [ChatScreen] Send blocked: already processing');
      return;
    }

    console.log(
      '📤 [ChatScreen] Sending message:',
      input.substring(0, 100) + '...',
    );
    await sendMessage(input.trim());
    setInput('');
  };

  const handleVoiceMessage = async () => {
    if (isRecording) {
      console.log('🎤 [ChatScreen] Stopping recording...');
      
      try {
        // Stop recording and get URI
        const uri = await recording.stopRecording();
        setIsRecording(false);
        console.log('🎤 [ChatScreen] Recording stopped, URI:', uri);

        if (uri) {
          setIsTranscribing(true);
          console.log('🎤 [ChatScreen] Starting transcription...');
          
          // Transcribe the audio file
          const result = await chatApi.transcribeAudio(uri);
          console.log('🎤 [ChatScreen] Transcription result:', result);

          if (result.success && result.text && result.text.trim()) {
            setInput(result.text.trim());
            console.log('🎤 [ChatScreen] Text set to input:', result.text.trim());
          } else {
            Alert.alert(
              'Transcription Error',
              result.error || 'No speech detected',
            );
          }
        } else {
          Alert.alert('Recording Error', 'No audio file created');
        }
      } catch (error) {
        console.error('❌ [ChatScreen] Recording/Transcription error:', error);
        Alert.alert('Error', 'Failed to process recording');
      } finally {
        setIsRecording(false);
        setIsTranscribing(false);
      }
    } else {
      console.log('🎤 [ChatScreen] Starting recording...');
      setIsRecording(true);
      await recording.startRecording();
    }
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          console.log('🗑️ [ChatScreen] Clearing chat');
          clearMessages();
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <MessageBubble
      message={item}
      isUser={item.role === 'user'}
      onCopy={() => {
        console.log(
          '📋 [ChatScreen] Message copied:',
          item.content.substring(0, 50) + '...',
        );
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity
          onPress={() => setIsDrawerVisible(true)}
          style={{ padding: 8 }}
        >
          <HamburgerIcon />
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
          GeistAI Debug
        </Text>

        <TouchableOpacity
          onPress={() => setIsDebugPanelVisible(!isDebugPanelVisible)}
          style={{
            padding: 8,
            backgroundColor: isDebugPanelVisible ? '#3B82F6' : '#E5E7EB',
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: isDebugPanelVisible ? '#FFFFFF' : '#374151',
            }}
          >
            DEBUG
          </Text>
        </TouchableOpacity>
      </View>

      {/* Network Status */}
      <NetworkStatus
        isConnected={isConnected}
        isInternetReachable={isInternetReachable}
      />

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View
          style={{
            flex: 1,
            marginLeft: slideAnim,
          }}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id || Math.random().toString()}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: 40,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#6B7280',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Welcome to GeistAI Debug Mode
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#9CA3AF',
                    textAlign: 'center',
                    lineHeight: 20,
                  }}
                >
                  Send a message to see detailed debugging information,
                  including routing, performance metrics, and response timing.
                </Text>
              </View>
            }
          />

          {/* Loading Indicator */}
          {(isLoading || isStreaming) && (
            <LoadingIndicator
              isLoading={isLoading}
              isStreaming={isStreaming}
              messageCount={messages.length}
            />
          )}

          {/* Input Bar */}
          <InputBar
            value={input}
            onChangeText={setInput}
            onSend={handleSendMessage}
            onVoiceInput={handleVoiceMessage}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            disabled={false}
            isStreaming={isStreaming}
            onStopRecording={handleVoiceMessage}
            onCancelRecording={handleVoiceMessage}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Debug Panel */}
      <DebugPanel
        debugInfo={debugInfo}
        isVisible={isDebugPanelVisible}
        onToggle={() => setIsDebugPanelVisible(!isDebugPanelVisible)}
      />

      {/* Chat Drawer */}
      <ChatDrawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        onClearChat={handleClearChat}
        currentChatId={currentChatId}
        onChatSelect={setCurrentChatId}
      />
    </SafeAreaView>
  );
}
