import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, FAB, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../src/config/theme';

export default function SellerProductsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.content}>
        <Text variant="titleLarge">My Products</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          No products yet. Add your first product!
        </Text>
      </View>
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => {}}
      />
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
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
  },
});
