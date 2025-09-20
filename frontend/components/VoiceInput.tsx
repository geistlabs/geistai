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
  language = 'en',
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
    setIsTranscribing(true);

    try {
      // Check if recording is too short
      if (recording.duration < 1) {
        onError?.('Recording too short. Please record for at least 1 second.');
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

  const getButtonIcon = () => {
    if (isTranscribing) {
      return 'hourglass-outline';
    }

    if (recording.isRecording) {
      return 'stop-circle';
    }

    if (recording.isPaused) {
      return 'play-circle';
    }

    return 'mic';
  };

  const getButtonColor = () => {
    if (isTranscribing) {
      return '#FFA500'; // Orange for processing
    }

    if (recording.isRecording) {
      return '#FF4444'; // Red for recording
    }

    if (recording.isPaused) {
      return '#4CAF50'; // Green for paused (resume)
    }

    return '#007AFF'; // Blue for ready to record
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

      {recording.error && (
        <Text style={styles.errorText}>{recording.error}</Text>
      )}

      {showRecordingControls && (
        <View style={styles.recordingInfo}>
          <Text style={styles.durationText}>
            {formatDuration(recording.duration)}
          </Text>

          {recording.isRecording && (
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={handlePauseRecording}
              activeOpacity={0.7}
            >
              <Ionicons name='pause' size={20} color='#666' />
            </TouchableOpacity>
          )}

          {recording.isPaused && (
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={handleResumeRecording}
              activeOpacity={0.7}
            >
              <Ionicons name='play' size={20} color='#666' />
            </TouchableOpacity>
          )}
        </View>
      )}

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
    paddingVertical: 16,
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
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  pauseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  transcribingText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
