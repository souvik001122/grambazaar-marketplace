import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { getTrustColor } from '../constants/colors';
import { getTrustLabel } from '../utils/trustScore';

interface TrustBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  score,
  showLabel = true,
  size = 'medium',
}) => {
  const color = getTrustColor(score);
  const label = getTrustLabel(score);

  const sizeStyles = {
    small: { width: 40, height: 40, fontSize: 12 },
    medium: { width: 50, height: 50, fontSize: 14 },
    large: { width: 60, height: 60, fontSize: 16 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: currentSize.width,
            height: currentSize.height,
            backgroundColor: color,
          },
        ]}
      >
        <Text style={[styles.score, { fontSize: currentSize.fontSize }]}>
          {score}
        </Text>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  score: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});
