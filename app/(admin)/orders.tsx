import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../src/config/theme';

export default function AdminOrdersScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.content}>
        <Text variant="titleLarge">All Orders</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Monitor all platform orders
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  subtitle: {
    marginTop: spacing.sm,
    opacity: 0.7,
  },
});
