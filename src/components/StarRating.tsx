import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const handlePress = (value: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= maxRating; i++) {
      const filled = i <= Math.floor(rating);
      const half = i === Math.ceil(rating) && rating % 1 !== 0;

      stars.push(
        <Ionicons
          key={i}
          name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
          size={size}
          color={COLORS.warning}
          style={styles.star}
          onPress={() => handlePress(i)}
        />
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <View style={styles.stars}>{renderStars()}</View>
      {showNumber && (
        <Text style={styles.ratingText}>
          {rating.toFixed(1)}
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
  star: {
    marginRight: 2,
  },
  ratingText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
});
