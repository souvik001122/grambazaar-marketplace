import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

interface PremiumTopBarProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showBack?: boolean;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightDisabled?: boolean;
}

export const PremiumTopBar: React.FC<PremiumTopBarProps> = ({
  title,
  subtitle,
  icon,
  showBack = false,
  onBack,
  rightLabel,
  onRightPress,
  rightDisabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.row}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </TouchableOpacity>
          )}

          {icon ? (
            <View style={styles.iconBadge}>
              <Ionicons name={icon} size={18} color="#FFF" />
            </View>
          ) : null}

          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>

        {!!rightLabel && !!onRightPress && (
          <TouchableOpacity
            style={[styles.rightButton, rightDisabled && styles.rightButtonDisabled]}
            onPress={onRightPress}
            disabled={rightDisabled}
            activeOpacity={0.8}
          >
            <Text style={styles.rightButtonText}>{rightLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  glowLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -110,
    right: -40,
  },
  glowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -80,
    left: -20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
  },
  rightButton: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  rightButtonDisabled: {
    opacity: 0.6,
  },
  rightButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
