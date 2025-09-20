import { useAudioSampleListener } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';

import { useAudioLevels } from '../hooks/useAudioLevels';
import { useRealAudioLevels } from '../hooks/useRealAudioLevels';

import { VoiceWaveform } from './VoiceWaveform';

/**
 * Test component to verify if expo-audio provides real-time audio sample data
 * This component will help us determine whether we need simulation or can use real data
 */
export function AudioTestComponent() {
  const [testResult, setTestResult] = useState<string>('Not tested');
  const realAudioLevels = useRealAudioLevels();
  const simulatedAudioLevels = useAudioLevels();

  // Direct test of useAudioSampleListener - call at top level
  const [directListenerResult, setDirectListenerResult] =
    useState<string>('Not tested');

  // Properly call the hook at component level
  let audioSampleListener = null;
  try {
    audioSampleListener = useAudioSampleListener();
  } catch (error) {
    console.error('[AudioTest] useAudioSampleListener hook error:', error);
  }

  useEffect(() => {
    try {
      // Test 1: Check if useAudioSampleListener exists and what it returns
      console.log(
        '[AudioTest] useAudioSampleListener returned:',
        audioSampleListener,
      );
      console.log('[AudioTest] Type:', typeof audioSampleListener);
      console.log(
        '[AudioTest] Is function:',
        typeof audioSampleListener === 'function',
      );
      console.log(
        '[AudioTest] Has properties:',
        Object.keys(audioSampleListener || {}),
      );

      if (audioSampleListener) {
        setDirectListenerResult(
          `Available - Type: ${typeof audioSampleListener}`,
        );
      } else {
        setDirectListenerResult('Hook returned null/undefined');
      }
    } catch (error) {
      console.error('[AudioTest] useAudioSampleListener error:', error);
      setDirectListenerResult(`Error: ${error}`);
    }
  }, [audioSampleListener]);

  const testRealAudioLevels = async () => {
    try {
      setTestResult('Testing real audio levels...');
      await realAudioLevels.startAnalyzing();

      // Wait 3 seconds to see if we get real data
      setTimeout(() => {
        if (realAudioLevels.hasRealData) {
          setTestResult('✅ Real audio data available!');
          Alert.alert('Success!', 'expo-audio provides real-time audio data');
        } else {
          setTestResult('❌ No real audio data received');
          Alert.alert(
            'No Real Data',
            'expo-audio does not provide real-time audio samples as expected',
          );
        }
        realAudioLevels.stopAnalyzing();
      }, 3000);
    } catch (error) {
      setTestResult(`❌ Error: ${error}`);
      console.error('[AudioTest] Test error:', error);
    }
  };

  const testSimulatedLevels = async () => {
    await simulatedAudioLevels.startAnalyzing();

    setTimeout(() => {
      simulatedAudioLevels.stopAnalyzing();
    }, 3000);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>
        expo-audio Real-time Audio Test
      </Text>

      <Text style={{ marginBottom: 10 }}>
        Direct Listener Test: {directListenerResult}
      </Text>

      <Text style={{ marginBottom: 10 }}>Real Audio Test: {testResult}</Text>

      <Button
        title='Test Real Audio Levels'
        onPress={testRealAudioLevels}
        color='#007AFF'
      />

      <View style={{ height: 20 }} />

      <Button
        title='Test Simulated Levels'
        onPress={testSimulatedLevels}
        color='#34C759'
      />

      <View style={{ height: 30 }} />

      <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
        Real Audio Waveform:
      </Text>
      <View
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <VoiceWaveform
          levels={realAudioLevels.levels}
          isActive={realAudioLevels.isAnalyzing}
          barCount={20}
          height={50}
          color={realAudioLevels.hasRealData ? '#007AFF' : '#FF3B30'}
        />
      </View>

      <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
        Simulated Audio Waveform:
      </Text>
      <View style={{ backgroundColor: '#f0f0f0', borderRadius: 10 }}>
        <VoiceWaveform
          levels={simulatedAudioLevels.levels}
          isActive={simulatedAudioLevels.isAnalyzing}
          barCount={20}
          height={50}
          color='#34C759'
        />
      </View>

      <Text style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
        Blue = Real audio data, Red = Failed real data, Green = Simulated data
      </Text>
    </View>
  );
}
