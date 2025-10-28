import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  flexCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000',
  },
  menuButton: {
    marginLeft: -8,
    marginRight: 8,
    padding: 8,
  },
  buttonContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: '#fee2e2',
  },
  resetButtonText: {
    color: '#b91c1c',
  },
  premiumBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumBadgeText: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: '500',
  },
  upgradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  storageButton: {
    backgroundColor: '#dbeafe',
  },
  storageButtonText: {
    color: '#1d4ed8',
  },
  memoryButton: {
    backgroundColor: '#dcfce7',
  },
  memoryButtonText: {
    color: '#15803d',
  },
  newChatButton: {
    backgroundColor: '#f3f4f6',
  },
  newChatButtonText: {
    color: '#374151',
  },
  messageList: {
    flex: 1,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  flatList: {
    flex: 1,
    backgroundColor: 'white',
  },
  flatListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  paywall: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paywallTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#14532d',
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#15803d',
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 30,
    fontWeight: '700',
    color: '#14532d',
  },
  priceUnit: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 4,
  },
  paywallSummary: {
    fontSize: 14,
    color: '#166534',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  paywallButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  paywallButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    zIndex: 5,
  },
});

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
    // setPremiumStatus, // Unused
    checkPremiumStatus,
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
    console.log(
      `🔄 [App] UI should update - Premium badge: ${isPremium ? 'Show' : 'Hide'}, Upgrade button: ${isPremium ? 'Hide' : 'Show'}`,
    );
  }, [isPremium]);

  // Debug: Log when negotiationResult changes
  useEffect(() => {
    console.log('💰 [App] negotiationResult changed to:', negotiationResult);
    if (negotiationResult) {
      console.log(
        `💰 [App] Upgrade button should show: $${negotiationResult.final_price.toFixed(2)}/mo`,
      );
    } else {
      console.log(
        '💰 [App] Negotiation result cleared - upgrade button should disappear',
      );
    }
  }, [negotiationResult]);

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
      } catch (error) {
        console.error('Failed to create new chat:', error);
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
    } catch (error) {
      console.error('Failed to create new chat:', error);
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

  const handleResetSubscription = async () => {
    try {
      console.log('🔄 [Reset] Starting subscription reset...');

      // Try to log out (ignore error if already anonymous)
      try {
        await revenuecat.logOut();
        console.log('✅ [Reset] Logged out successfully');
      } catch {
        console.log('ℹ️ [Reset] Already anonymous user, continuing...');
      }

      // Try to cancel subscription via RevenueCat API
      const cancelSuccess = await revenuecat.cancelSubscription();

      if (cancelSuccess) {
        console.log('✅ [Reset] Subscription cancelled via API');
      } else {
        console.log(
          '⚠️ [Reset] API cancellation failed, using development override',
        );
        // Fallback to development override if API fails
        revenuecat.setDevelopmentOverride(false);
      }

      // Force refresh premium status
      const isPremiumAfterReset = await revenuecat.isPremiumUser();

      // Update local state to trigger immediate UI update (avoid deprecated setPremiumStatus)
      await checkPremiumStatus();

      console.log(
        '✅ [Reset] Reset complete. Premium status:',
        isPremiumAfterReset,
      );

      Alert.alert(
        'Subscription Reset',
        `Successfully reset! Premium status: ${isPremiumAfterReset ? 'Active' : 'Inactive'}`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('❌ [Reset] Reset failed:', error);
      Alert.alert(
        'Reset Failed',
        'Failed to reset subscription. Please try again.',
        [{ text: 'OK' }],
      );
    }
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
        console.log(
          '✅ [Upgrade] Purchase successful! Updating premium status...',
        );

        // Clear any development override since we have a real purchase
        revenuecat.clearDevelopmentOverride();

        // Force refresh premium status to update UI immediately
        await checkPremiumStatus();

        Alert.alert(
          'Success!',
          `Welcome to GeistAI Premium at $${(priceInfo as any).final_price ? (priceInfo as any).final_price.toFixed(2) : (priceInfo as any).price.toFixed(2)}/month!`,
          [
            {
              text: 'Continue',
              onPress: () => {
                console.log(
                  '🔄 [Upgrade] Premium status should now be updated',
                );
              },
            },
          ],
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
      console.error('Failed to start recording:', error);
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
      console.error('Failed to process recording:', error);
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
      console.debug('Ignoring error during recording cancel:', error);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.flexCenter}>
          <Text style={{ fontSize: 18, color: '#4b5563' }}>
            Initializing app...
          </Text>
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
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Network Status */}
            {!isConnected && (
              <NetworkStatus isOnline={isConnected} position='top' />
            )}

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.flexRow}>
                {/* Left side - Hamburger Menu */}
                <TouchableOpacity
                  onPress={handleDrawerOpen}
                  style={styles.menuButton}
                >
                  <HamburgerIcon size={20} color='#374151' />
                </TouchableOpacity>

                {/* Center - Title */}
                <View style={styles.flexRow}>
                  <Text style={styles.title}>Geist</Text>
                </View>

                {/* Right side - Buttons */}
                <View style={styles.buttonContainer}>
                  {/* Development Reset Button */}
                  {__DEV__ && (
                    <TouchableOpacity
                      onPress={handleResetSubscription}
                      style={[styles.button, styles.resetButton]}
                    >
                      <Text style={[styles.buttonText, styles.resetButtonText]}>
                        🔄 Reset
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* Development Toggle Button */}
                  {/* <TouchableOpacity
                    onPress={togglePremiumStatus}
                    style={[styles.button, { backgroundColor: '#ffedd5' }]}
                  >
                    <Text style={[styles.buttonText, { color: '#9a3412' }]}>
                      🔧 Toggle Premium
                    </Text>
                  </TouchableOpacity> */}
                  {isPremium ? (
                    <View style={styles.premiumBadge}>
                      <Text style={styles.premiumBadgeText}>
                        ✅ Premium Active
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleUpgradeNow}
                      style={[
                        styles.upgradeButton,
                        {
                          backgroundColor: negotiationResult
                            ? '#22c55e'
                            : '#3b82f6',
                        },
                      ]}
                    >
                      <Text style={styles.upgradeButtonText}>
                        {negotiationResult
                          ? `Upgrade $${negotiationResult.final_price.toFixed(2)}/mo`
                          : `Upgrade $${INITIAL_PRICE.price}/mo`}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleStoragePress}
                    style={[styles.button, styles.storageButton]}
                  >
                    <Text style={[styles.buttonText, styles.storageButtonText]}>
                      Storage
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push('/memory')}
                    style={[styles.button, styles.memoryButton]}
                  >
                    <Text style={[styles.buttonText, styles.memoryButtonText]}>
                      Memory
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNewChat}
                    style={[styles.button, styles.newChatButton]}
                  >
                    <Text style={[styles.buttonText, styles.newChatButtonText]}>
                      New Chat
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Messages List */}
            <View style={styles.messageList}>
              {isLoading && enhancedMessages.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <LoadingIndicator size='medium' />
                  {storageError && (
                    <Text style={styles.errorText}>{storageError}</Text>
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
                  contentContainerStyle={styles.flatListContent}
                  style={styles.flatList}
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                />
              )}
            </View>

            {/* Negotiation Result Paywall */}
            {negotiationResult && !isPremium && (
              <View style={styles.paywall}>
                <Text style={styles.paywallTitle}>✅ Deal Finalized!</Text>

                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Your Negotiated Price</Text>
                  <Text style={styles.priceAmount}>
                    ${negotiationResult.final_price.toFixed(2)}
                  </Text>
                  <Text style={styles.priceUnit}>per month</Text>
                </View>

                <Text style={styles.paywallSummary}>
                  &ldquo;{negotiationResult.negotiation_summary}&rdquo;
                </Text>

                <TouchableOpacity
                  onPress={handleUpgradeNow}
                  style={styles.paywallButton}
                >
                  <Text style={styles.paywallButtonText}>
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
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>
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
        {isDrawerVisible && <View style={styles.overlay} />}
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
