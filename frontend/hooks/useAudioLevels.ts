import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioLevelsData {
  levels: number[]; // Array of audio levels (0-1)
  isAnalyzing: boolean;
  averageLevel: number;
}

export interface AudioLevelsControls {
  startAnalyzing: () => Promise<void>;
  stopAnalyzing: () => void;
  updateLevels: (newLevels: number[]) => void;
}

/**
 * Hook for managing real-time audio level analysis during recording
 * Since expo-audio doesn't provide real-time audio levels, we simulate
 * realistic voice patterns that respond to speaking vs silence
 */
export function useAudioLevels(): AudioLevelsData & AudioLevelsControls {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(20).fill(0));
  const [averageLevel, setAverageLevel] = useState(0);

  const animationFrameRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const voicePatternRef = useRef({
    isSpeaking: false,
    speakingDuration: 0,
    silenceDuration: 0,
    lastPatternChange: Date.now(),
  });

  // Simulate realistic voice patterns
  const generateVoicePattern = useCallback(() => {
    const now = Date.now();
    const pattern = voicePatternRef.current;

    // Simulate natural speech patterns: 0.5-3s speaking, 0.2-1.5s pauses
    if (pattern.isSpeaking) {
      pattern.speakingDuration += 100;

      // Switch to silence after speaking for 0.5-3 seconds
      if (pattern.speakingDuration > 500 + Math.random() * 2500) {
        pattern.isSpeaking = false;
        pattern.speakingDuration = 0;
        pattern.silenceDuration = 0;
        pattern.lastPatternChange = now;
      }
    } else {
      pattern.silenceDuration += 100;

      // Switch to speaking after 0.2-1.5 seconds of silence
      if (pattern.silenceDuration > 200 + Math.random() * 1300) {
        pattern.isSpeaking = true;
        pattern.speakingDuration = 0;
        pattern.silenceDuration = 0;
        pattern.lastPatternChange = now;
      }
    }

    return pattern.isSpeaking;
  }, []);

  // Generate realistic audio levels
  const generateAudioLevels = useCallback(() => {
    const isSpeaking = generateVoicePattern();
    const newLevels: number[] = [];

    for (let i = 0; i < 20; i++) {
      if (isSpeaking) {
        // Simulate voice amplitude: varied levels with natural fluctuation
        const baseLevel = 0.3 + Math.random() * 0.7; // 30-100% amplitude
        const variation = Math.sin(Date.now() / 200 + i) * 0.2; // Smooth variation
        const randomness = (Math.random() - 0.5) * 0.3; // Natural randomness

        newLevels[i] = Math.max(
          0.1,
          Math.min(1, baseLevel + variation + randomness),
        );
      } else {
        // Silence with minimal background noise
        newLevels[i] = Math.random() * 0.08; // 0-8% background noise
      }
    }

    const average =
      newLevels.reduce((sum, level) => sum + level, 0) / newLevels.length;

    setLevels(newLevels);
    setAverageLevel(average);
  }, [generateVoicePattern]);

  const startAnalyzing = useCallback(async () => {
    setIsAnalyzing(true);

    // Reset voice pattern
    voicePatternRef.current = {
      isSpeaking: false,
      speakingDuration: 0,
      silenceDuration: 0,
      lastPatternChange: Date.now(),
    };

    // Start with a brief silence, then begin speaking pattern
    setTimeout(() => {
      voicePatternRef.current.isSpeaking = true;
    }, 300);

    // Generate new levels every 100ms (10 FPS for smooth animation)
    intervalRef.current = setInterval(generateAudioLevels, 100);
  }, [generateAudioLevels]);

  const stopAnalyzing = useCallback(() => {
    setIsAnalyzing(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Gradually fade to silence
    const fadeToSilence = () => {
      setLevels(prev => {
        const newLevels = prev.map(level => level * 0.8); // Fade by 20% each frame
        const maxLevel = Math.max(...newLevels);

        if (maxLevel > 0.05) {
          animationFrameRef.current = requestAnimationFrame(fadeToSilence);
          return newLevels;
        } else {
          return Array(20).fill(0);
        }
      });
    };

    fadeToSilence();
    setAverageLevel(0);
  }, []);

  const updateLevels = useCallback((newLevels: number[]) => {
    setLevels(newLevels);
    const average =
      newLevels.reduce((sum, level) => sum + level, 0) / newLevels.length;
    setAverageLevel(average);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    levels,
    isAnalyzing,
    averageLevel,
    startAnalyzing,
    stopAnalyzing,
    updateLevels,
  };
}
