import {
  AudioModule,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
  error: string | null;
}

export interface AudioRecordingControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  resetRecording: () => void;
}

export function useAudioRecording(): AudioRecordingState &
  AudioRecordingControls {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    uri: null,
    error: null,
  });

  // Configure for WAV format (LINEARPCM) - optimal for Whisper.cpp
  const audioRecorder = useAudioRecorder({
    extension: '.wav',
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    android: {
      outputFormat: 'default',
      audioEncoder: 'default',
    },
    ios: {
      outputFormat: IOSOutputFormat.LINEARPCM,
      audioQuality: 96,
    },
    web: {
      mimeType: 'audio/wav',
      bitsPerSecond: 128000,
    },
  });
  const recorderState = useAudioRecorderState(audioRecorder);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          const { PermissionsAndroid } = require('react-native');
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Audio Recording Permission',
              message:
                'This app needs access to your microphone to record audio.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission to access microphone was denied');
          }
        } else {
          // For iOS, use expo-audio's permission request
          const status = await AudioModule.requestRecordingPermissionsAsync();
          if (!status.granted) {
            Alert.alert('Permission to access microphone was denied');
          }
        }

        // Set audio mode for recording
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      } catch (error) {
        console.error('Failed to setup audio permissions:', error);
      }
    })();
  }, []);

  // Sync expo-audio recorder state with our local state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isRecording: recorderState.isRecording,
      // expo-audio doesn't have isPaused in RecorderState, we'll manage it ourselves
    }));
  }, [recorderState.isRecording]);

  const updateDuration = useCallback(() => {
    setState(prev => ({ ...prev, duration: prev.duration + 1 }));
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    durationIntervalRef.current = setInterval(updateDuration, 1000);
  }, [updateDuration]);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Check permissions first
      const permissionStatus = await AudioModule.getRecordingPermissionsAsync();
      console.log('[AUDIO] Permission status:', permissionStatus);

      if (!permissionStatus.granted) {
        throw new Error('Microphone permission not granted');
      }

      // Prepare and start recording using expo-audio
      console.log('[AUDIO] Preparing to record...');
      await audioRecorder.prepareToRecordAsync();
      console.log('[AUDIO] Starting recording...');
      audioRecorder.record();

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        uri: null,
      }));

      startDurationTimer();
      console.log('[AUDIO] Recording started successfully');
    } catch (error) {
      console.error('[AUDIO] Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, [audioRecorder, startDurationTimer]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      console.log('[AUDIO] Stopping recording...');
      // Stop recording using expo-audio
      await audioRecorder.stop();

      // The recording URI will be available on audioRecorder.uri
      const uri = audioRecorder.uri;
      console.log('[AUDIO] Recording stopped, URI:', uri);

      if (!uri) {
        throw new Error('No recording URI generated');
      }

      stopDurationTimer();

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        uri: uri || null,
      }));

      console.log('[AUDIO] Recording completed successfully');
      return uri || null;
    } catch (error) {
      console.error('[AUDIO] Failed to stop recording:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to stop recording',
        isRecording: false,
        isPaused: false,
      }));
      stopDurationTimer();
      return null;
    }
  }, [audioRecorder, stopDurationTimer]);

  const pauseRecording = useCallback(async () => {
    try {
      if (!recorderState.isRecording) {
        return;
      }

      // expo-audio doesn't have explicit pause - we'll use stop/start pattern
      await audioRecorder.stop();
      stopDurationTimer();

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: true,
      }));
    } catch (error) {
      console.error('Failed to pause recording:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to pause recording',
      }));
    }
  }, [audioRecorder, recorderState.isRecording, stopDurationTimer]);

  const resumeRecording = useCallback(async () => {
    try {
      if (!state.isPaused) {
        return;
      }

      // Resume by starting a new recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      startDurationTimer();

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
      }));
    } catch (error) {
      console.error('Failed to resume recording:', error);
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to resume recording',
      }));
    }
  }, [audioRecorder, state.isPaused, startDurationTimer]);

  const resetRecording = useCallback(() => {
    try {
      if (recorderState.isRecording) {
        audioRecorder.stop();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }

    stopDurationTimer();

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      uri: null,
      error: null,
    });
  }, [audioRecorder, recorderState.isRecording, stopDurationTimer]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
