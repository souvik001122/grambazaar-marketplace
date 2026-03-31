import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { spacing } from '../../src/config/theme';
import { showAlert } from '../../src/utils/alert';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Attempting login...');
      const user = await authService.signIn(email, password);
      console.log('Login successful:', user);
      setUser(user);
      
      // Navigate based on user role
      if (user?.role === 'seller') {
        console.log('Navigating to seller dashboard');
        router.replace('/(seller)');
      } else if (user?.role === 'admin') {
        console.log('Navigating to admin dashboard');
        router.replace('/(admin)');
      } else {
        console.log('Navigating to buyer dashboard');
        router.replace('/(buyer)');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.message || err.response?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      showAlert('Login Error', errorMessage);
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
              Connecting Rural Artisans with Buyers
            </Text>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.cardTitle}>
                Welcome Back
              </Text>

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

              {error ? (
                <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
              ) : null}

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Login
              </Button>

              <Button
                mode="text"
                onPress={() => router.push('/(auth)/signup')}
                style={styles.linkButton}
              >
                Don't have an account? Sign Up
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
