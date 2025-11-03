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
  const monthlyEquivalent = (annualPrice / 12).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.gradientBackground} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>GeistAI Premium</Text>
            <Text style={styles.subtitle}>Unlock unlimited AI features</Text>
          </View>
        </View>

        <View style={styles.pricingSection}>
          <View style={styles.priceRow}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Monthly</Text>
              <Text style={styles.priceValue}>${monthlyPrice}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Annual</Text>
              <View style={styles.annualContainer}>
                <Text style={styles.priceValue}>${annualPrice}</Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save 20%</Text>
                </View>
              </View>
              <Text style={styles.pricePeriod}>${monthlyEquivalent}/month</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.upgradeButton,
            isLoading && styles.upgradeButtonDisabled,
          ]}
          onPress={onUpgrade}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.upgradeButtonText}>
            {isLoading ? 'Processing...' : 'Upgrade to Premium'}
          </Text>
          {!isLoading && <Text style={styles.upgradeArrow}>→</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#007bff',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  pricingSection: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  pricePeriod: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  annualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  savingsBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upgradeButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#007bff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upgradeArrow: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
