import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAudioRecording } from '../hooks/useAudioRecording';
import { ChatAPI, STTResponse } from '../lib/api/chat';

interface VoiceInputProps {
  chatAPI: ChatAPI;
  onTranscriptionComplete: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

export function VoiceInput({
  chatAPI,
  onTranscriptionComplete,
  onError,
  language, // Use automatic language detection when undefined
}: VoiceInputProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recording = useAudioRecording();

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      await recording.startRecording();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to start recording';
      onError?.(errorMessage);
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await recording.stopRecording();
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to stop recording';
      onError?.(errorMessage);
    }
  };

  const handlePauseRecording = async () => {
    try {
      await recording.pauseRecording();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to pause recording';
      onError?.(errorMessage);
    }
  };

  const handleResumeRecording = async () => {
    try {
      await recording.resumeRecording();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to resume recording';
      onError?.(errorMessage);
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      setIsTranscribing(true);

      // Check minimum recording duration
      if (recording.duration < 1) {
        onError?.('Recording too short. Please speak for at least 1 second.');
        return;
      }

      const result: STTResponse = await chatAPI.transcribeAudio(
        audioUri,
        language,
      );

      if (result.success && result.text.trim()) {
        onTranscriptionComplete(result.text.trim());
      } else {
        const errorMessage = result.error || 'No speech detected';
        onError?.(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  };

  const getButtonColor = () => {
    if (isTranscribing) return '#666';
    if (recording.isRecording) return '#FF3B30';
    if (recording.isPaused) return '#FF9500';
    return '#007AFF';
  };

  const getButtonIcon = () => {
    if (isTranscribing) return 'hourglass-outline';
    if (recording.isRecording) return 'stop';
    if (recording.isPaused) return 'play';
    return 'mic';
  };

  const handleButtonPress = async () => {
    if (isTranscribing) {
      return; // Don't allow interaction while transcribing
    }

    if (recording.isRecording) {
      await handleStopRecording();
    } else if (recording.isPaused) {
      await handleResumeRecording();
    } else {
      await handleStartRecording();
    }
  };

  const showRecordingControls = recording.isRecording || recording.isPaused;

  return (
    <View style={styles.container}>
      {/* Simple recording button */}
      <TouchableOpacity
        style={[styles.recordButton, { backgroundColor: getButtonColor() }]}
        onPress={handleButtonPress}
        disabled={isTranscribing}
        activeOpacity={0.8}
      >
        {isTranscribing ? (
          <ActivityIndicator color='white' size='large' />
        ) : (
          <Ionicons name={getButtonIcon()} size={32} color='white' />
        )}
      </TouchableOpacity>

      {/* Simple status and duration */}
      {showRecordingControls && (
        <View style={styles.recordingInfo}>
          <Text style={styles.recordingText}>Recording...</Text>
          <Text style={styles.durationText}>
            {formatDuration(recording.duration)}
          </Text>
        </View>
      )}

      {/* Simple controls */}
      {showRecordingControls && (
        <View style={styles.controls}>
          {recording.isRecording && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePauseRecording}
            >
              <Ionicons name='pause' size={20} color='#666' />
            </TouchableOpacity>
          )}
          {recording.isPaused && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleResumeRecording}
            >
              <Ionicons name='play' size={20} color='#666' />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleStopRecording}
          >
            <Ionicons name='stop' size={20} color='#666' />
          </TouchableOpacity>
        </View>
      )}

      {/* Error message */}
      {recording.error && (
        <Text style={styles.errorText}>{recording.error}</Text>
      )}

      {/* Transcribing message */}
      {isTranscribing && (
        <Text style={styles.transcribingText}>
          Converting speech to text...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 20,
  },
  recordingInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    fontFamily: 'monospace',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  transcribingText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
