import { useAudioSampleListener } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

export interface RealAudioLevelsData {
  levels: number[]; // Array of audio levels (0-1)
  isAnalyzing: boolean;
  averageLevel: number;
  hasRealData: boolean; // Whether we're getting actual audio samples
}

export interface RealAudioLevelsControls {
  startAnalyzing: () => Promise<void>;
  stopAnalyzing: () => void;
}

/**
 * Hook for managing REAL-TIME audio level analysis during recording
 * This attempts to use expo-audio's useAudioSampleListener for actual audio data
 */
export function useRealAudioLevels(): RealAudioLevelsData &
  RealAudioLevelsControls {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(20).fill(0));
  const [averageLevel, setAverageLevel] = useState(0);
  const [hasRealData, setHasRealData] = useState(false);

  // Try to use the real audio sample listener
  const audioSampleListener = useAudioSampleListener();

  // Process audio samples to extract amplitude levels
  const processAudioSample = useCallback((sample: any) => {
    console.log('[RealAudioLevels] Received audio sample:', sample);

    try {
      // Check if we have actual audio sample data
      if (sample && sample.channels && Array.isArray(sample.channels)) {
        setHasRealData(true);

        // Extract amplitude data from audio samples
        const channelData = sample.channels[0]; // Use first channel (mono or left channel)

        if (channelData && Array.isArray(channelData)) {
          // Calculate RMS (Root Mean Square) amplitude for different segments
          const segmentSize = Math.max(1, Math.floor(channelData.length / 20));
          const newLevels: number[] = [];

          for (let i = 0; i < 20; i++) {
            const start = i * segmentSize;
            const end = Math.min(start + segmentSize, channelData.length);
            const segment = channelData.slice(start, end);

            // Calculate RMS amplitude for this segment
            const rms = Math.sqrt(
              segment.reduce(
                (sum: number, value: number) => sum + value * value,
                0,
              ) / segment.length,
            );

            // Normalize to 0-1 range (assuming audio samples are in -1 to 1 range)
            newLevels[i] = Math.min(1, Math.abs(rms));
          }

          const average =
            newLevels.reduce((sum, level) => sum + level, 0) / newLevels.length;

          setLevels(newLevels);
          setAverageLevel(average);

          console.log('[RealAudioLevels] Processed levels:', {
            newLevels: newLevels.slice(0, 5),
            average,
          });
        }
      } else {
        console.log('[RealAudioLevels] No usable audio data in sample');
      }
    } catch (error) {
      console.error('[RealAudioLevels] Error processing audio sample:', error);
      setHasRealData(false);
    }
  }, []);

  // Set up the audio sample listener
  useEffect(() => {
    if (isAnalyzing && audioSampleListener) {
      console.log('[RealAudioLevels] Starting real-time audio analysis');

      try {
        // Check if audioSampleListener has a way to register for samples
        if (typeof audioSampleListener === 'function') {
          const unsubscribe = audioSampleListener(processAudioSample);
          return unsubscribe;
        } else if (
          audioSampleListener &&
          typeof audioSampleListener.start === 'function'
        ) {
          audioSampleListener.start(processAudioSample);
          return () => audioSampleListener.stop?.();
        } else {
          console.log(
            '[RealAudioLevels] useAudioSampleListener API not as expected:',
            typeof audioSampleListener,
          );
          setHasRealData(false);
        }
      } catch (error) {
        console.error(
          '[RealAudioLevels] Error setting up audio sample listener:',
          error,
        );
        setHasRealData(false);
      }
    }
  }, [isAnalyzing, audioSampleListener, processAudioSample]);

  const startAnalyzing = useCallback(async () => {
    console.log('[RealAudioLevels] Starting analysis...');
    setIsAnalyzing(true);
    setHasRealData(false);

    // Reset levels
    setLevels(Array(20).fill(0));
    setAverageLevel(0);
  }, []);

  const stopAnalyzing = useCallback(() => {
    console.log('[RealAudioLevels] Stopping analysis...');
    setIsAnalyzing(false);
    setHasRealData(false);

    // Fade to silence
    setLevels(Array(20).fill(0));
    setAverageLevel(0);
  }, []);

  return {
    levels,
    isAnalyzing,
    averageLevel,
    hasRealData,
    startAnalyzing,
    stopAnalyzing,
  };
}
