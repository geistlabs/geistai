import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ChatAPI } from '../lib/api/chat';

import { VoiceInput } from './VoiceInput';

interface VoiceInputModalProps {
  visible: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  chatAPI: ChatAPI;
  language?: string;
}

export function VoiceInputModal({
  visible,
  onClose,
  onTranscriptionComplete,
  chatAPI,
  language, // Use automatic language detection when undefined
}: VoiceInputModalProps) {
  const handleTranscriptionComplete = (text: string) => {
    onTranscriptionComplete(text);
    onClose();
  };

  const handleError = (error: string) => {
    Alert.alert('Voice Input Error', error, [{ text: 'OK', style: 'default' }]);
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name='close' size={24} color='#666' />
          </TouchableOpacity>
          <Text style={styles.title}>Voice Input</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Voice Input Component */}
        <View style={styles.content}>
          <VoiceInput
            chatAPI={chatAPI}
            onTranscriptionComplete={handleTranscriptionComplete}
            onError={handleError}
            language={language}
          />
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Tap and hold the microphone to start recording
          </Text>
          <Text style={styles.instructionSubtext}>
            Release to stop and transcribe your speech
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60, // Account for status bar
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40, // Same width as close button to center title
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructions: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  instructionSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
