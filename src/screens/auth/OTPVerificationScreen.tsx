import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showAlert } from '../../utils/alert';
import { COLORS } from '../../constants/colors';

const OTPVerificationScreen = ({ route, navigation }: any) => {
  const { phone, name, role, isRegistration } = route.params;
  const { verifyPhoneOTP, loginWithPhone, sendOTP, registerWithPhone } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

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

  const handleVerify = async () => {
    if (otp.length !== 6) {
      showAlert('Error', 'Please enter a 6-digit OTP');
      return;
    }

    try {
      setLoading(true);

      if (isRegistration) {
        // Verify OTP for registration
        await verifyPhoneOTP(phone, otp);
        // After OTP verification, complete registration
        await registerWithPhone(phone, name, role);
        showAlert('Success', 'Registration successful! You are now logged in.');
        // Navigation handled by AppNavigator based on role
      } else {
        // Verify OTP for login
        await loginWithPhone(phone, otp);
        // Navigation handled by AppNavigator based on role
      }
    } catch (error: any) {
      showAlert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      setLoading(true);
      await sendOTP(phone);
      setTimer(60);
      setCanResend(false);
      showAlert('OTP Sent', 'A new OTP has been sent to your phone');
    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        extraHeight={120}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to {'\n'}
          {phone}
        </Text>
        {__DEV__ && (
          <View style={styles.devBadge}>
            <Text style={styles.devText}>DEV MODE: Use 123456</Text>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          value={otp}
          onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          caretHidden
          selectionColor="transparent"
        />

        <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
          <Text style={styles.verifyButtonText}>Verify OTP</Text>
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendText}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend OTP in {timer}s
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.changeNumber}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.changeNumberText}>Change Phone Number</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  devBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  devText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  form: {
    padding: 30,
  },
  otpInput: {
    height: 70,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 30,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  timerText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  changeNumber: {
    alignItems: 'center',
  },
  changeNumberText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default OTPVerificationScreen;
