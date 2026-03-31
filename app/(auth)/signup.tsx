import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { spacing } from '../../src/config/theme';
import { UserRole } from '../../src/types';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('buyer');

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await authService.signUp(email, password, name, role);
      setUser(user);
      
      // Navigate based on user role
      if (user?.role === 'seller') {
        router.replace('/(seller)');
      } else if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(buyer)');
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
              GramBazaar
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Join our community of artisans and buyers
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.cardTitle}>
                Create Account
              </Text>

              <View style={styles.roleContainer}>
                <Button
                  mode={role === 'buyer' ? 'contained' : 'outlined'}
                  onPress={() => setRole('buyer')}
                  style={styles.roleButton}
                >
                  Buyer
                </Button>
                <Button
                  mode={role === 'seller' ? 'contained' : 'outlined'}
                  onPress={() => setRole('seller')}
                  style={styles.roleButton}
                >
                  Seller
                </Button>
              </View>

              <TextInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="account" />}
              />

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />

              <TextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                style={styles.input}
                left={<TextInput.Icon icon="lock-check" />}
              />

              {error ? (
                <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
              ) : null}

              <Button
                mode="contained"
                onPress={handleSignUp}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Sign Up
              </Button>

              <Button
                mode="text"
                onPress={() => router.push('/(auth)/login')}
                style={styles.linkButton}
              >
                Already have an account? Login
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  card: {
    elevation: 4,
  },
  cardTitle: {
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  roleButton: {
    flex: 1,
  },
  input: {
    marginBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
  },
  linkButton: {
    marginTop: spacing.sm,
  },
});
