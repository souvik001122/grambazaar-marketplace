import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  showNumber?: boolean;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 16,
  showNumber = true,
  interactive = false,
  onRatingChange,
}) => {
  const normalizedRating = Math.max(0, Math.min(maxRating, Number.isFinite(rating) ? rating : 0));

  const handlePress = (value: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
    }
  };

  const renderStarNode = (fillRatio: number) => {
    const clampedFill = Math.max(0, Math.min(1, fillRatio));

    if (clampedFill >= 0.999) {
      return <Ionicons name="star" size={size} color={COLORS.warning} />;
    }

    if (clampedFill <= 0.001) {
      return <Ionicons name="star-outline" size={size} color={COLORS.warning} />;
    }

    return (
      <View style={[styles.partialStarWrap, { width: size, height: size }]}>
        <Ionicons name="star-outline" size={size} color={COLORS.warning} style={styles.partialStarBase} />
        <View style={[styles.partialStarMask, { width: size * clampedFill }]}>
          <Ionicons name="star" size={size} color={COLORS.warning} style={styles.partialStarBase} />
        </View>
      </View>
    );
  };

  const renderStars = () =>
    Array.from({ length: maxRating }, (_, index) => {
      const starValue = index + 1;
      const fillRatio = normalizedRating - index;

      return (
        <TouchableOpacity
          key={starValue}
          activeOpacity={0.8}
          disabled={!interactive}
          onPress={() => handlePress(starValue)}
          style={styles.starTouchable}
        >
          {renderStarNode(fillRatio)}
        </TouchableOpacity>
      );
    });

  return (
    <View style={styles.container}>
      <View style={styles.stars}>{renderStars()}</View>
      {showNumber && (
        <Text style={styles.ratingText}>
          {normalizedRating.toFixed(1)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
  },
  starTouchable: {
    marginRight: 2,
  },
  partialStarWrap: {
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  partialStarBase: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  partialStarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    overflow: 'hidden',
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
});
