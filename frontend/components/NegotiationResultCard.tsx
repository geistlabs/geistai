import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { NegotiationResult } from '../lib/api/chat';

interface PricingCardProps {
  result: NegotiationResult;
  mode: 'detailed' | 'compact';
  onUpgradeMonthly: () => void;
  onUpgradeAnnual: () => void;
  onToggleMode: () => void;
  isLoading?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  result,
  mode,
  onUpgradeMonthly,
  onUpgradeAnnual,
  onToggleMode,
  isLoading = false,
}) => {
  // Calculate annual savings
  const monthlyPrice = result.final_price;
  const annualPrice = 95.99;
  const annualSavings = (monthlyPrice * 12 - annualPrice).toFixed(2);

  if (mode === 'compact') {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactContent}>
          <Text style={styles.compactText}>
            Monthly ${monthlyPrice} | Annual ${annualPrice} (20% off)
          </Text>
          <TouchableOpacity
            style={styles.compactUpgradeButton}
            onPress={onUpgradeMonthly}
            disabled={isLoading}
          >
            <Text style={styles.compactButtonText}>
              {isLoading ? 'Processing...' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.toggleButton} onPress={onToggleMode}>
          <Text style={styles.toggleButtonText}>▼</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💎 Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Select the pricing option that works best for you
        </Text>
        <TouchableOpacity style={styles.minimizeButton} onPress={onToggleMode}>
          <Text style={styles.minimizeButtonText}>−</Text>
        </TouchableOpacity>
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
            Save 20% • ${annualSavings} savings
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
  // Compact mode styles
  compactContainer: {
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactText: {
    fontSize: 14,
    color: '#212529',
    fontWeight: '500',
  },
  compactUpgradeButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 12,
  },
  compactButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    padding: 8,
    marginLeft: 8,
  },
  toggleButtonText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  // Toggle buttons for detailed mode
  minimizeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
  },
  minimizeButtonText: {
    fontSize: 20,
    color: '#6c757d',
    fontWeight: 'bold',
  },
});
