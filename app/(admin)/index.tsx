import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../src/config/theme';

export default function AdminDashboardScreen() {
  const theme = useTheme();

  const stats = [
    { label: 'Pending Verifications', value: '0', icon: 'account-clock' },
    { label: 'Pending Products', value: '0', icon: 'package-variant-closed' },
    { label: 'Active Orders', value: '0', icon: 'cart' },
    { label: 'Total Revenue', value: '₹0', icon: 'currency-inr' },
  ];

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            Admin Dashboard
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Monitor and manage the platform
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
  subtitle: {
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
});
