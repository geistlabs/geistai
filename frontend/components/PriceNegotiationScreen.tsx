import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import {
  NEGOTIATION_QUESTIONS,
  calculateRecommendedPrice,
  getPricePointByPrice,
} from '../lib/pricing';

interface PriceNegotiationScreenProps {
  onComplete: (selectedPrice: number) => void;
  onSkip: () => void;
}

export function PriceNegotiationScreen({
  onComplete,
  onSkip,
}: PriceNegotiationScreenProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [recommendedPrice, setRecommendedPrice] = useState(30);

  const currentQuestion = NEGOTIATION_QUESTIONS[currentQuestionIndex];
  const isLastQuestion =
    currentQuestionIndex === NEGOTIATION_QUESTIONS.length - 1;

  const handleAnswer = (priceImpact: number) => {
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: priceImpact,
    };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      // Calculate and show result
      const price = calculateRecommendedPrice(newAnswers);
      setRecommendedPrice(price);
      setShowResult(true);
    } else {
      // Move to next question
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  if (showResult) {
    const pricePoint = getPricePointByPrice(recommendedPrice);

    return (
      <ScrollView className='flex-1 bg-white'>
        <View className='flex-1 px-6 py-12'>
          {/* AI Avatar */}
          <View className='items-center mb-8'>
            <Text className='text-6xl mb-4'>🤖</Text>
            <Text className='text-3xl font-bold mb-3 text-center'>
              Perfect Match Found!
            </Text>
            <Text className='text-lg text-gray-600 text-center'>
              Based on your needs, here's your personalized price
            </Text>
          </View>

          {/* Recommended Price */}
          <View className='bg-blue-50 rounded-3xl p-8 mb-6 border-2 border-blue-200'>
            <Text className='text-sm text-gray-600 text-center mb-2'>
              YOUR PERSONALIZED PRICE
            </Text>
            <Text className='text-5xl font-bold text-center mb-2'>
              ${recommendedPrice}
            </Text>
            <Text className='text-center text-gray-700 text-lg font-medium'>
              per month
            </Text>
            {pricePoint && (
              <View className='mt-4 pt-4 border-t border-blue-200'>
                <Text className='text-center text-gray-600 text-sm'>
                  {pricePoint.description}
                </Text>
              </View>
            )}
          </View>

          {/* Accept Button */}
          <TouchableOpacity
            onPress={() => onComplete(recommendedPrice)}
            className='bg-blue-600 py-5 rounded-2xl mb-4 shadow-lg'
          >
            <Text className='text-white text-xl font-bold text-center'>
              Continue with ${recommendedPrice}/mo
            </Text>
          </TouchableOpacity>

          {/* Alternative Options */}
          <TouchableOpacity
            onPress={() => {
              setShowResult(false);
              setCurrentQuestionIndex(0); // Reset to first question
              setAnswers({}); // Clear previous answers
            }}
            className='py-3'
          >
            <Text className='text-blue-600 text-center font-semibold'>
              Start Over
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkip} className='py-3'>
            <Text className='text-gray-500 text-center'>
              See All Pricing Options
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className='flex-1 bg-white'>
      <View className='flex-1 px-6 py-12'>
        {/* Header */}
        <View className='items-center mb-8'>
          <Text className='text-5xl mb-4'>💬</Text>
          <Text className='text-2xl font-bold mb-3 text-center'>
            Let's Find Your Perfect Price
          </Text>
          <Text className='text-base text-gray-600 text-center'>
            Answer a few quick questions to get your personalized price
          </Text>
        </View>

        {/* Progress */}
        <View className='mb-8'>
          <View className='flex-row justify-between mb-2'>
            <Text className='text-sm text-gray-500'>
              Question {currentQuestionIndex + 1} of{' '}
              {NEGOTIATION_QUESTIONS.length}
            </Text>
            <Text className='text-sm text-blue-600 font-semibold'>
              {Math.round(
                ((currentQuestionIndex + 1) / NEGOTIATION_QUESTIONS.length) *
                  100,
              )}
              %
            </Text>
          </View>
          <View className='h-2 bg-gray-200 rounded-full overflow-hidden'>
            <View
              className='h-full bg-blue-600'
              style={{
                width: `${((currentQuestionIndex + 1) / NEGOTIATION_QUESTIONS.length) * 100}%`,
              }}
            />
          </View>
        </View>

        {/* Question */}
        <View className='mb-6'>
          <Text className='text-xl font-semibold mb-6 text-center'>
            {currentQuestion.question}
          </Text>

          {/* Answer Options */}
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleAnswer(option.priceImpact)}
              className='bg-white border-2 border-gray-200 rounded-xl p-5 mb-4 active:bg-blue-50 active:border-blue-400'
            >
              <Text className='text-lg text-center font-medium'>
                {option.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Skip Option */}
        <TouchableOpacity onPress={onSkip} className='py-3 mt-4'>
          <Text className='text-gray-500 text-center'>
            Skip personalization →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
