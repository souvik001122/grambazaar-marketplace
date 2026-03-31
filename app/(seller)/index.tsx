import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { spacing } from '../../src/config/theme';

export default function SellerDashboardScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);

  const stats = [
    { label: 'Total Products', value: '0', icon: 'package-variant' },
    { label: 'Active Orders', value: '0', icon: 'cart' },
    { label: 'Total Revenue', value: '₹0', icon: 'currency-inr' },
    { label: 'Pending Approvals', value: '0', icon: 'clock-outline' },
  ];

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            Seller Dashboard
          </Text>
          <Text variant="bodyMedium" style={styles.welcome}>
            Welcome back, {user?.name}!
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Card key={index} style={styles.statCard}>
              <Card.Content>
                <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
                  {stat.value}
                </Text>
                <Text variant="bodyMedium" style={styles.statLabel}>
                  {stat.label}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium">Getting Started</Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              1. Complete your seller profile verification{'\n'}
              2. Add your products{'\n'}
              3. Wait for admin approval{'\n'}
              4. Start receiving orders!
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
  },
  welcome: {
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
  },
  statLabel: {
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  infoCard: {
    margin: spacing.md,
  },
  infoText: {
    marginTop: spacing.md,
    lineHeight: 24,
  },
});
