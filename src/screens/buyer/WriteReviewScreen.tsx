import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { createReview, hasUserReviewedProduct } from '../../services/reviewService';
import { StarRating } from '../../components/StarRating';
import { showAlert } from '../../utils/alert';

const WriteReviewScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const productId = route?.params?.productId;
  const productName = route?.params?.productName || 'Product';
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !productId) return;

    if (rating === 0) {
      showAlert('Error', 'Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      // Check if already reviewed
      const alreadyReviewed = await hasUserReviewedProduct(productId, user.$id);
      if (alreadyReviewed) {
        showAlert('Already Reviewed', 'You have already reviewed this product');
        navigation.goBack();
        return;
      }

      await createReview({
        productId,
        userId: user.$id,
        rating,
        comment: comment.trim(),
      });

      showAlert('Review Submitted!', 'Thank you for your review', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Review error:', err);
      showAlert('Error', 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (!productId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Invalid product</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
      extraHeight={120}
      showsVerticalScrollIndicator={false}
    >
        <Text style={styles.title}>Review</Text>
        <Text style={styles.productName}>{productName}</Text>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.label}>Your Rating</Text>
          <StarRating
            rating={rating}
            size={36}
            interactive
            onRatingChange={setRating}
            showNumber={false}
          />
          <Text style={styles.ratingLabel}>
            {rating === 0 ? 'Tap to rate' :
             rating === 1 ? 'Poor' :
             rating === 2 ? 'Fair' :
             rating === 3 ? 'Good' :
             rating === 4 ? 'Very Good' : 'Excellent'}
          </Text>
        </View>

        {/* Comment */}
        <View style={styles.commentSection}>
          <Text style={styles.label}>Your Review (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience with this product..."
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, (rating === 0 || submitting) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="star" size={20} color="#FFF" />
              <Text style={styles.submitText}>Submit Review</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  productName: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 24 },
  ratingSection: { alignItems: 'center', padding: 24, backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 12 },
  ratingLabel: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 8 },
  commentSection: { marginBottom: 24 },
  textArea: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16,
    fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surface,
    minHeight: 120,
  },
  charCount: { fontSize: 12, color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, padding: 16, borderRadius: 12,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.5 },
});

export default WriteReviewScreen;
