import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { NegotiationResult } from '../lib/api/chat';

interface NegotiationResultCardProps {
  result: NegotiationResult;
  onUpgradeMonthly: () => void;
  onUpgradeAnnual: () => void;
  isLoading?: boolean;
}

export const NegotiationResultCard: React.FC<NegotiationResultCardProps> = ({
  result,
  onUpgradeMonthly,
  onUpgradeAnnual,
  isLoading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💎 Choose Your Plan</Text>
        <Text style={styles.subtitle}>Select the pricing option that works best for you</Text>
      </View>

      <View style={styles.pricingContainer}>
        {/* Monthly Plan Card */}
        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Monthly Plan</Text>
          <Text style={styles.planPrice}>${result.final_price}/month</Text>
          <Text style={styles.planDescription}>
            Pay monthly, cancel anytime
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, styles.monthlyButton]}
            onPress={onUpgradeMonthly}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Processing...' : 'Upgrade Monthly'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Annual Plan Card */}
        <View style={[styles.planCard, styles.annualCard]}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>20% OFF</Text>
          </View>
          <Text style={styles.planTitle}>Annual Plan</Text>
          <Text style={styles.planPrice}>$95.99/year</Text>
          <Text style={styles.planDescription}>
            Save 20% • ${result.final_price * 12 - 95.99} savings
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, styles.annualButton]}
            onPress={onUpgradeAnnual}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Processing...' : 'Upgrade Annual'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
    position: 'relative',
  },
  annualCard: {
    borderColor: '#28a745',
    borderWidth: 2,
  },
  badgeContainer: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 16,
  },
  upgradeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  monthlyButton: {
    backgroundColor: '#6c757d',
  },
  annualButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
