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
import { usePremium } from '../hooks/usePremium';
import { revenuecat } from '../lib/revenuecat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(288, SCREEN_WIDTH * 0.85);

// Initial premium price configuration
const INITIAL_PRICE = {
  price: 39.99,
  package_id: 'premium_monthly_40',
};

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

  // Call ALL hooks FIRST before any conditional logic
  const {
    isPremium,
    isLoading: premiumLoading,
    // togglePremiumStatus,
  } = usePremium();

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
    negotiationResult,
  } = useChatWithStorage({ chatId: currentChatId, isPremium });

  // Debug: Log when isPremium changes
  useEffect(() => {
    console.log(`🔄 [App] isPremium changed to: ${isPremium}`);
  }, [isPremium]);

  // Rest of the component for premium users...
  useEffect(() => {
    if (enhancedMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [enhancedMessages.length]);

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
  }, [isDrawerVisible, slideAnim]);

  const handleDrawerOpen = () => {
    setIsDrawerVisible(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerVisible(false);
  };

  const handleStoragePress = () => {
    router.push('/storage');
  };

  const handleUpgradeNow = async () => {
    // Use either negotiation result or initial price
    const priceInfo = negotiationResult || INITIAL_PRICE;

    try {
      console.log('💰 [Upgrade] Starting purchase process for:', priceInfo);

      // Get RevenueCat offerings
      const offerings = await revenuecat.getOfferings();

      // DEBUG CODE:
      console.log('🔍 [Debug] Full offerings:', offerings);
      console.log('🔍 [Debug] Current offering exists:', !!offerings.current);
      console.log(
        '🔍 [Debug] Available packages count:',
        offerings.current?.availablePackages?.length,
      );
      console.log(
        '🔍 [Debug] Package identifiers:',
        offerings.current?.availablePackages?.map((p: any) => p.identifier),
      );

      if (!offerings.current) {
        Alert.alert('Error', 'No subscription packages available');
        return;
      }

      // Find the offering that matches the negotiated price
      const packageId = priceInfo.package_id;
      const offeringKey = packageId; // e.g., "premium_monthly_40"
      const targetOffering = offerings.all[offeringKey];

      if (!targetOffering) {
        Alert.alert('Error', `Offering ${offeringKey} not found`);
        console.error('Available offerings:', Object.keys(offerings.all));
        return;
      }

      // Get the package from the target offering (should be the first/only one)
      const package_ = targetOffering.availablePackages[0];

      if (!package_) {
        Alert.alert('Error', `No packages found in offering ${offeringKey}`);
        return;
      }

      console.log(
        '💰 [Upgrade] Found package:',
        package_.identifier,
        'Price:',
        package_.product.price,
      );

      // Initiate purchase
      const { customerInfo, userCancelled } =
        await revenuecat.purchasePackage(package_);

      if (userCancelled) {
        console.log('⚠️ [Upgrade] Purchase cancelled by user');
        return;
      }

      // Check if purchase was successful
      if (customerInfo.entitlements.active['premium']) {
        Alert.alert(
          'Success!',
          `Welcome to GeistAI Premium at $${(priceInfo as any).final_price ? (priceInfo as any).final_price.toFixed(2) : (priceInfo as any).price.toFixed(2)}/month!`,
        );
      } else {
        Alert.alert('Purchase Failed', 'Please try again');
      }
    } catch (err) {
      console.error('❌ [Upgrade] Purchase error:', err);
      Alert.alert(
        'Purchase Error',
        'Failed to complete purchase. Please try again.',
      );
    }
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
        console.error('Failed to create new chat:', err);
        Alert.alert('Error', 'Failed to create new chat');
        return;
      }
    }
  };

  // Now we can do conditional rendering
  if (premiumLoading) {
    return (
      <SafeAreaView className='flex-1 bg-white'>
        <View className='flex-1 justify-center items-center'>
          <Text className='text-lg text-gray-600'>Initializing app...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use the same UI for both premium and non-premium users
  // Only difference: endpoint and welcome message
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
                  {/* Development Toggle Button */}
                  {/* <TouchableOpacity
                    onPress={togglePremiumStatus}
                    className='px-3 py-1.5 bg-orange-100 rounded-lg'
                  >
                    <Text className='text-sm text-orange-700'>
                      🔧 Toggle Premium
                    </Text>
                  </TouchableOpacity> */}
                  {isPremium ? (
                    <View className='px-4 py-1.5 bg-green-100 rounded-lg flex-row items-center'>
                      <Text className='text-green-700 text-sm font-medium'>
                        ✅ Premium Active
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleUpgradeNow}
                      className={`px-4 py-1.5 rounded-lg flex-row items-center ${
                        negotiationResult ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                    >
                      <Text className='text-white text-sm font-medium'>
                        {negotiationResult
                          ? `Upgrade $${negotiationResult.final_price.toFixed(2)}/mo`
                          : `Upgrade $${INITIAL_PRICE.price}/mo`}
                      </Text>
                    </TouchableOpacity>
                  )}
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
                        <EnhancedMessageBubble
                          message={item}
                          allMessages={enhancedMessages}
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

            {/* Negotiation Result Paywall */}
            {negotiationResult && !isPremium && (
              <View className='mx-4 mb-4 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200'>
                <Text className='text-sm font-semibold text-green-900 mb-2'>
                  ✅ Deal Finalized!
                </Text>

                <View className='mb-3'>
                  <Text className='text-xs text-green-700 mb-1'>
                    Your Negotiated Price
                  </Text>
                  <Text className='text-3xl font-bold text-green-900'>
                    ${negotiationResult.final_price.toFixed(2)}
                  </Text>
                  <Text className='text-xs text-green-600 mt-1'>per month</Text>
                </View>

                <Text className='text-sm text-green-800 mb-3 italic'>
                  &ldquo;{negotiationResult.negotiation_summary}&rdquo;
                </Text>

                <TouchableOpacity
                  onPress={handleUpgradeNow}
                  className='bg-green-600 px-4 py-3 rounded-lg'
                >
                  <Text className='text-white text-center font-semibold'>
                    Upgrade Now at ${negotiationResult.final_price.toFixed(2)}
                    /mo
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
