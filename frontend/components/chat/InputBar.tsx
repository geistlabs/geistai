import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAudioLevels } from '../../hooks/useAudioLevels';
import { VoiceWaveform } from '../VoiceWaveform';

interface InputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onInterrupt?: () => void;
  onVoiceInput?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  isRecording?: boolean;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;
}

export function InputBar({
  value,
  onChangeText,
  onSend,
  onInterrupt,
  onVoiceInput,
  disabled = false,
  isStreaming = false,
  isRecording = false,
  onStopRecording,
  onCancelRecording,
}: InputBarProps) {
  const isDisabled = disabled || (!value.trim() && !isStreaming);
  const audioLevels = useAudioLevels();

  // Start/stop audio analysis based on recording state
  React.useEffect(() => {
    if (isRecording && !audioLevels.isAnalyzing) {
      audioLevels.startAnalyzing();
    } else if (!isRecording && audioLevels.isAnalyzing) {
      audioLevels.stopAnalyzing();
    }
  }, [isRecording, audioLevels]);

  // Show recording interface when recording
  if (isRecording) {
    return (
      <View className='p-2'>
        {/* Mobile ChatGPT-style recording interface */}
        <View className='flex-row items-center'>
          {/* Stop button (white square) */}
          <TouchableOpacity
            className='justify-center items-center mr-2'
            onPress={onCancelRecording}
          >
            <View className='w-11 h-11 rounded-full bg-gray-100 items-center justify-center'>
              <View className='w-4 h-4 bg-gray-600 rounded-sm' />
            </View>
          </TouchableOpacity>

          {/* Voice-responsive waveform input field */}
          <View
            className='flex-1 rounded-full'
            style={{ backgroundColor: '#f8f8f8', height: 44 }}
          >
            <VoiceWaveform
              levels={audioLevels.levels}
              isActive={audioLevels.isAnalyzing}
              barCount={18}
              height={44}
              barWidth={2.5}
              barSpacing={1.5}
              minBarHeight={3}
              maxBarHeight={28}
              color='#6B7280'
              animationDuration={120}
            />
          </View>

          {/* Send/Up arrow button */}
          <TouchableOpacity
            className='justify-center items-center ml-2'
            onPress={onStopRecording}
          >
            <View className='w-11 h-11 rounded-full bg-black items-center justify-center'>
              <Ionicons name='arrow-up' size={22} color='white' />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Normal text input interface
  return (
    <View className='p-2'>
      <View className='flex-row items-end'>
        <View
          className='flex-1 min-h-11 max-h-20 rounded-full px-4 py-2'
          style={{ backgroundColor: '#f8f8f8' }}
        >
          <TextInput
            className='bg-transparent pl-2'
            value={value}
            onChangeText={onChangeText}
            placeholder='Ask anything'
            multiline={true}
            editable={!disabled}
            style={{
              fontSize: 15,
              paddingTop: 8,
              paddingBottom: 8,
              textAlignVertical: 'center',
            }}
          />
        </View>
        {/* Voice Input Button */}
        {!isStreaming && onVoiceInput && (
          <TouchableOpacity
            className='justify-center items-center mr-2'
            onPress={onVoiceInput}
            disabled={disabled}
          >
            <View className='w-11 h-11 rounded-full bg-gray-100 items-center justify-center'>
              <Ionicons name='mic' size={22} color='#666' />
            </View>
          </TouchableOpacity>
        )}

        {/* Send/Stop Button */}
        <TouchableOpacity
          className='justify-center items-center'
          onPress={isStreaming ? onInterrupt : onSend}
          disabled={isDisabled && !isStreaming}
        >
          {isStreaming ? (
            // Pause icon - white rectangle on black rounded background
            <View className='w-11 h-11 rounded-full bg-black items-center justify-center'>
              <View className='w-4 h-4 rounded-sm bg-white' />
            </View>
          ) : (
            <View className='w-11 h-11 rounded-full bg-black items-center justify-center'>
              <Svg
                width={22}
                height={22}
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='white'
                fill='none'
              >
                <Path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5'
                />
              </Svg>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
