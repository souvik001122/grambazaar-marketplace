import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { account, EMAIL_VERIFICATION_URL } from '../../config/appwrite';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

const EmailVerificationScreen = ({ route, navigation }: any) => {
  const email = route?.params?.email || '';
  const [sending, setSending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleResendVerification = async () => {
    if (!canResend) return;
    setSending(true);
    try {
      // The verification URL — Appwrite handles this
      await account.createVerification(EMAIL_VERIFICATION_URL);
      setTimer(60);
      setCanResend(false);
      showAlert('Email Sent', 'Verification email has been resent. Check your inbox.');
    } catch (error: any) {
      console.error('Resend verification error:', error);
      showAlert('Error', error.message || 'Failed to resend verification email');
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    try {
      const user = await account.get();
      if (user.emailVerification) {
        showAlert('Verified!', 'Your email has been verified. You can now login.', [
          { text: 'Go to Login', onPress: () => {
            // Logout current session and go to login
            try { account.deleteSession('current'); } catch {}
            navigation.navigate('Login');
          }},
        ]);
      } else {
        showAlert('Not Yet Verified', 'Please check your email and click the verification link first.');
      }
    } catch (error: any) {
      showAlert('Error', 'Please try logging in.');
      navigation.navigate('Login');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={72} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to
        </Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.description}>
          Please check your inbox and click the verification link to activate your account. Also check your spam folder.
        </Text>

        {/* Check Verification Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          {canResend ? (
            <TouchableOpacity onPress={handleResendVerification} disabled={sending}>
              {sending ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Text style={styles.resendText}>Resend Verification Email</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>Resend in {timer}s</Text>
          )}
        </View>

        {/* Go to Login */}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => {
            try { account.deleteSession('current'); } catch {}
            navigation.navigate('Login');
          }}
        >
          <Text style={styles.loginLinkText}>
            Already verified? <Text style={styles.loginLinkBold}>Go to Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  timerText: {
    color: COLORS.textTertiary,
    fontSize: 14,
  },
  loginLink: {
    marginTop: 8,
  },
  loginLinkText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  loginLinkBold: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});

export default EmailVerificationScreen;
