import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing } from '../../src/config/theme';

export default function RoleSelectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      router.push('/(auth)/signup');
    }
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
            GramBazaar
          </Text>
          <Text variant="titleLarge" style={styles.subtitle}>
            I want to...
          </Text>
        </View>

        <Card
          style={[
            styles.roleCard,
            selectedRole === 'buyer' && { borderColor: theme.colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setSelectedRole('buyer')}
        >
          <Card.Content style={styles.roleContent}>
            <Text variant="headlineSmall">🛍️</Text>
            <Text variant="titleLarge" style={styles.roleTitle}>
              Buy Products
            </Text>
            <Text variant="bodyMedium" style={styles.roleDescription}>
              Discover and purchase authentic handmade products from verified rural artisans
            </Text>
          </Card.Content>
        </Card>

        <Card
          style={[
            styles.roleCard,
            selectedRole === 'seller' && { borderColor: theme.colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setSelectedRole('seller')}
        >
          <Card.Content style={styles.roleContent}>
            <Text variant="headlineSmall">🎨</Text>
            <Text variant="titleLarge" style={styles.roleTitle}>
              Sell Products
            </Text>
            <Text variant="bodyMedium" style={styles.roleDescription}>
              Showcase your crafts to a wider audience and grow your artisan business
            </Text>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!selectedRole}
          style={styles.continueButton}
        >
          Continue
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/(auth)/login')}
          style={styles.loginButton}
        >
          Already have an account? Login
        </Button>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  subtitle: {
    marginTop: spacing.md,
  },
  roleCard: {
    marginBottom: spacing.md,
    elevation: 4,
  },
  roleContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  roleTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  roleDescription: {
    textAlign: 'center',
    opacity: 0.7,
  },
  continueButton: {
    marginTop: spacing.xl,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
});
