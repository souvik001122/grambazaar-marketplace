import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getStatusColor } from '../constants/colors';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium' | 'large';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  const color = getStatusColor(status);

  const getIcon = () => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'verified':
      case 'active':
      case 'approved':
      case 'paid':
      case 'success':
      case 'delivered':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'processing':
        return 'construct-outline';
      case 'shipped':
        return 'airplane-outline';
      case 'failed':
      case 'cancelled':
      case 'rejected':
      case 'blocked':
        return 'close-circle';
      case 'refunded':
        return 'arrow-undo-circle';
      default:
        return 'help-circle';
    }
  };

  const getLabel = () => {
    if (!status) return 'Unknown';
    const normalized = status.toLowerCase();
    if (normalized === 'success') return 'Paid';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const sizeStyles = {
    small: { fontSize: 10, iconSize: 12, padding: 4 },
    medium: { fontSize: 12, iconSize: 14, padding: 6 },
    large: { fontSize: 14, iconSize: 16, padding: 8 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: `${color}15`, padding: currentSize.padding },
      ]}
    >
      <Ionicons
        name={getIcon()}
        size={currentSize.iconSize}
        color={color}
        style={styles.icon}
      />
      <Text style={[styles.text, { color, fontSize: currentSize.fontSize }]}>
        {getLabel()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
});
