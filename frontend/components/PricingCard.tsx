import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';

import { NegotiationResult } from '../lib/api/chat';

interface PricingCardProps {
  result: NegotiationResult;
  onUpgrade: () => void;
  isLoading?: boolean;
  monthlyPackage?: PurchasesPackage;
  annualPackage?: PurchasesPackage;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  result,
  onUpgrade,
  isLoading = false,
  monthlyPackage,
  annualPackage,
}) => {
  // Get pricing from RevenueCat packages (source of truth) or fallback to negotiation result
  const monthlyPrice = monthlyPackage
    ? monthlyPackage.product.price
    : result.final_price;
  const annualPrice = annualPackage ? annualPackage.product.price : 95.99; // Fallback to hardcoded value if no package available
  const monthlyEquivalent = (annualPrice / 12).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header - Compact */}
        <View style={styles.header}>
          <Text style={styles.title}>Premium</Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save 20%</Text>
          </View>
        </View>

        {/* Pricing - Horizontal Layout */}
        <View style={styles.pricingRow}>
          <View style={styles.priceItem}>
            <Text style={styles.priceValue}>
              {monthlyPackage?.product.priceString || `$${monthlyPrice}`}
            </Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceItem}>
            <Text style={styles.priceValue}>
              {annualPackage?.product.priceString || `$${annualPrice}`}
            </Text>
            <Text style={styles.pricePeriod}>${monthlyEquivalent}/mo</Text>
          </View>
        </View>

        {/* CTA Button */}
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
            {isLoading ? 'Processing...' : 'Upgrade'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  savingsBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pricingRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
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
    marginHorizontal: 8,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  pricePeriod: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  upgradeButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonDisabled: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
