import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { NegotiationResult } from '../lib/api/chat';

interface PricingCardProps {
  result: NegotiationResult;
  onUpgrade: () => void;
  isLoading?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  result,
  onUpgrade,
  isLoading = false,
}) => {
  const monthlyPrice = result.final_price;
  const annualPrice = 95.99;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>💎 GeistAI Premium</Text>
          <Text style={styles.pricing}>
            Monthly ${monthlyPrice} | Annual ${annualPrice}{' '}
            <Text style={styles.discount}>(20% off)</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgrade}
          disabled={isLoading}
        >
          <Text style={styles.upgradeButtonText}>
            {isLoading ? 'Processing...' : 'Upgrade →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  pricing: {
    fontSize: 14,
    color: '#495057',
  },
  discount: {
    color: '#28a745',
    fontWeight: '600',
  },
  upgradeButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
