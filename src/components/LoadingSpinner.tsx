import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Animated } from 'react-native';
import { COLORS } from '../constants/colors';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = COLORS.primary,
  fullScreen = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (fullScreen) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [fullScreen, pulseAnim]);

  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        <View style={styles.splashContent}>
          <Animated.Text style={[styles.splashEmoji, { opacity: pulseAnim }]}>🏺</Animated.Text>
          <Text style={styles.splashTitle}>GramBazaar</Text>
          <Text style={styles.splashSubtitle}>Rural Marketplace • Authentic Crafts</Text>
          <View style={styles.splashLoaderWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCFBF9', // Warm premium earthy backdrop
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  splashSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  splashLoaderWrap: {
    marginTop: 40,
    height: 20,
    justifyContent: 'center',
  },
});

