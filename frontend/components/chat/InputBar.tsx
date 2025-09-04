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
    // TODO: Check if text is valid and not disabled
    // TODO: Call onSend with trimmed text
    // TODO: Clear input field
  };

  return (
    <View className="bg-white border-t border-gray-200 px-4 py-3">
      {/* TODO: Add flex-row container with TextInput and Send button */}
      {/* TODO: TextInput should have value={inputText} and onChangeText={setInputText} */}
      {/* TODO: Send button should call handleSend and be disabled when no text */}
    </View>
  );
}