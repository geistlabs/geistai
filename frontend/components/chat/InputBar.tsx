import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { useState } from "react";

interface InputBarProps {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InputBar({ onSend, placeholder = "Type a message...", disabled = false }: InputBarProps) {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim() || disabled) return;
    
    onSend(inputText.trim());
    setInputText("");
  };

  return (
    <View className="bg-white border-t border-gray-200 px-4 py-3">
      <View className="flex-row items-center space-x-2">
        <TextInput
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-base"
          placeholder={placeholder}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!disabled}
        />
        <TouchableOpacity 
          onPress={handleSend}
          className="bg-blue-500 rounded-full p-3"
          disabled={!inputText.trim() || disabled}
        >
          <Text className="text-white font-semibold">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}